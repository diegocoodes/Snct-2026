import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

import { requireRole } from "@/lib/auth";
import { readAuditEvents, recordAuditEvent } from "@/lib/audit";
import { onlyDigits, isValidCpf } from "@/lib/cpf";
import { query } from "@/lib/db";
import {
  normalizeCidade,
  normalizeEstado,
} from "@/lib/estados-brasil";
import {
  createEstande,
  deleteEstande,
  listEstandes,
  updateEstande,
  type EstandeStatus,
} from "@/lib/estandes";
import { hashPassword, isStrongPassword } from "@/lib/password";
import {
  aprovarProjeto,
  cancelarAprovacaoProjeto,
  listProjetosAdmin,
  rejeitarProjeto,
  type ProjetoStatus,
} from "@/lib/projetos-admin";
import { listAvaliadoresComAvaliacoesAdmin } from "@/lib/avaliacoes";
import {
  assertTrustedMutation,
  enforceRateLimit,
  securityErrorResponse,
} from "@/lib/request-security";
import {
  getRoleByCodigo,
  listRoles,
} from "@/lib/roles";
import {
  normalizeEventDate,
} from "@/lib/events";
import {
  deletePartnerLogoFile,
  savePartnerLogo,
} from "@/lib/partners";
import {
  formatRegistrationPeriod,
  isValidHttpUrl,
  resolveNoticeStatus,
} from "@/lib/notices";
import {
  deleteNoticeDocumentFile,
  readSnctStore,
  saveNoticeDocument,
  updateSnctStore,
} from "@/lib/snct-store";
import type {
  ManagedEvent,
  ManagedNotice,
  ManagedNoticeDocument,
  ManagedPartner,
  RoleCodigo,
} from "@/lib/snct-types";
import {
  changeUserRole,
  createQrCodeHash,
  listRoleChanges,
  setUserActive,
} from "@/lib/usuarios";

function clean(value: unknown, maximumLength = 300) {
  return typeof value === "string" ? value.trim().slice(0, maximumLength) : "";
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function isAllowedImageUrl(value: string) {
  if (value.startsWith("/")) return !value.startsWith("//");
  try {
    const url = new URL(value);
    const allowedHosts = new Set([
      "paulista.pe.gov.br",
      "snct.paulista.pe.gov.br",
      ...(process.env.SNCT_ALLOWED_IMAGE_HOSTS?.split(",")
        .map((host) => host.trim().toLowerCase())
        .filter(Boolean) ?? []),
    ]);
    return (
      url.protocol === "https:" && allowedHosts.has(url.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

async function authorizeMutation(request: Request) {
  assertTrustedMutation(request);
  const session = await requireRole("admin");
  if (!session) return null;
  await enforceRateLimit({
    request,
    scope: "admin",
    identifier: session.userId,
    limit: 120,
    windowSeconds: 60,
  });
  return session;
}

export async function GET(request: Request) {
  const session = await requireRole("admin");
  if (!session) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }
  const url = new URL(request.url);
  if (url.searchParams.get("resource") === "game-forms") {
    const forms = await prisma.gameForm.findMany({
      orderBy: { createdAt: "desc" },
    });
    return Response.json({
      forms: forms.map((form) => ({
        ...form,
        createdAt: form.createdAt.toISOString(),
        updatedAt: form.updatedAt.toISOString(),
      })),
    });
  }
  if (url.searchParams.get("resource") === "avaliacoes") {
    const avaliadores = await listAvaliadoresComAvaliacoesAdmin();
    return Response.json({ avaliadores });
  }
  const usuarioId = url.searchParams.get("usuarioId");
  if (usuarioId) {
    const [store, roleHistory, roles] = await Promise.all([
      readSnctStore(),
      listRoleChanges(usuarioId),
      listRoles(),
    ]);
    const user = store.users.find((item) => item.id === usuarioId);
    if (!user) {
      return Response.json({ error: "Usuário não encontrado." }, { status: 404 });
    }
    return Response.json({ user, roleHistory, roles });
  }

  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const projetoStatus = url.searchParams.get("projetoStatus");
  const [store, auditLogs, roles, estandes, projetos] = await Promise.all([
    readSnctStore(),
    readAuditEvents(100),
    listRoles(),
    listEstandes(),
    listProjetosAdmin(
      projetoStatus === "PENDENTE" ||
        projetoStatus === "APROVADO" ||
        projetoStatus === "REJEITADO"
        ? (projetoStatus as ProjetoStatus)
        : undefined,
    ),
  ]);
  const users = q
    ? store.users.filter(
        (user) =>
          user.name.toLowerCase().includes(q) ||
          user.email.toLowerCase().includes(q) ||
          (user.cpf ?? "").includes(onlyDigits(q)),
      )
    : store.users;
  return Response.json({ ...store, users, auditLogs, roles, estandes, projetos });
}

const MAX_NOTICE_DOCUMENTS = 2;

function collectNoticeUploadFiles(formData: FormData) {
  const files: File[] = [];
  for (const key of ["document", "document2"]) {
    const value = formData.get(key);
    if (value instanceof File && value.size > 0) files.push(value);
  }
  return files;
}

export async function POST(request: Request) {
  const uploadedDocuments: ManagedNoticeDocument[] = [];
  let uploadedPartnerLogo: string | undefined;
  try {
    const session = await authorizeMutation(request);
    if (!session)
      return Response.json({ error: "Não autorizado." }, { status: 401 });

    const formData = await request.formData().catch(() => null);
    const action = clean(formData?.get("action"));
    if (!formData || (action !== "saveNotice" && action !== "addPartner")) {
      return Response.json({ error: "Ação inválida." }, { status: 400 });
    }

    if (action === "addPartner") {
      const name = clean(formData.get("name"), 160);
      const logoFile = formData.get("logo");
      if (!name) {
        return Response.json(
          { error: "Informe o nome da instituição." },
          { status: 400 },
        );
      }
      if (!(logoFile instanceof File) || logoFile.size <= 0) {
        return Response.json(
          { error: "Anexe o arquivo da logomarca." },
          { status: 400 },
        );
      }

      uploadedPartnerLogo = await savePartnerLogo(logoFile);
      const partner: ManagedPartner = {
        id: `partner-${randomUUID()}`,
        name,
        logo: uploadedPartnerLogo,
        hidden: false,
      };
      await updateSnctStore((store) => store.partners.push(partner));
      await recordAuditEvent(request, {
        actorId: session.userId,
        actorRole: session.role,
        action: "partner.create",
        entity: "partner",
        entityId: partner.id,
      });
      return Response.json({ partner });
    }

    const title = clean(formData.get("title"), 220);
    const description = clean(formData.get("description"), 8000);
    const registrationStartsAt = clean(formData.get("registrationStartsAt"), 10);
    const registrationEndsAt = clean(formData.get("registrationEndsAt"), 10);
    const formUrlRaw = clean(formData.get("formUrl"), 2000);
    const id = clean(formData.get("id"), 100) || `notice-${randomUUID()}`;
    const uploadFiles = collectNoticeUploadFiles(formData);

    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!title || !description) {
      return Response.json(
        { error: "Informe o título e a descrição do edital." },
        { status: 400 },
      );
    }
    if (
      !registrationStartsAt ||
      !registrationEndsAt ||
      !datePattern.test(registrationStartsAt) ||
      !datePattern.test(registrationEndsAt)
    ) {
      return Response.json(
        { error: "Informe as datas de início e encerramento das inscrições." },
        { status: 400 },
      );
    }
    if (registrationEndsAt < registrationStartsAt) {
      return Response.json(
        {
          error:
            "A data de encerramento deve ser igual ou posterior à data de início.",
        },
        { status: 400 },
      );
    }
    if (formUrlRaw && !isValidHttpUrl(formUrlRaw)) {
      return Response.json(
        {
          error:
            "Informe um link válido (http/https) para o formulário de inscrição.",
        },
        { status: 400 },
      );
    }

    const currentStore = await readSnctStore();
    const existingCount =
      currentStore.notices.find((item) => item.id === id)?.documents.length ?? 0;
    if (existingCount + uploadFiles.length > MAX_NOTICE_DOCUMENTS) {
      return Response.json(
        {
          error: `Cada edital pode ter no máximo ${MAX_NOTICE_DOCUMENTS} arquivos anexados.`,
        },
        { status: 400 },
      );
    }

    for (const file of uploadFiles) {
      uploadedDocuments.push(await saveNoticeDocument(file));
    }

    const registration = formatRegistrationPeriod(
      registrationStartsAt,
      registrationEndsAt,
    );
    const status = resolveNoticeStatus({
      registrationStartsAt,
      registrationEndsAt,
      status: "aberto",
    });

    const notice = await updateSnctStore<ManagedNotice>((store) => {
      const index = store.notices.findIndex((item) => item.id === id);
      const documents = index >= 0 ? [...store.notices[index].documents] : [];
      documents.push(...uploadedDocuments);
      if (documents.length > MAX_NOTICE_DOCUMENTS) {
        throw new Error(
          `Cada edital pode ter no máximo ${MAX_NOTICE_DOCUMENTS} arquivos anexados.`,
        );
      }
      const nextNotice: ManagedNotice = {
        id,
        title,
        description,
        registration,
        registrationStartsAt,
        registrationEndsAt,
        formUrl: formUrlRaw,
        status,
        documents,
      };
      if (index >= 0) store.notices[index] = nextNotice;
      else store.notices.unshift(nextNotice);
      return nextNotice;
    });

    await recordAuditEvent(request, {
      actorId: session.userId,
      actorRole: session.role,
      action: "notice.save",
      entity: "notice",
      entityId: notice.id,
      metadata: { documentsAttached: uploadedDocuments.length },
    });
    return Response.json({ notice });
  } catch (error) {
    await Promise.all(
      uploadedDocuments.map((document) =>
        deleteNoticeDocumentFile(document.storageName).catch(() => {}),
      ),
    );
    if (uploadedPartnerLogo) {
      await deletePartnerLogoFile(uploadedPartnerLogo).catch(() => {});
    }
    return securityErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await authorizeMutation(request);
    if (!session)
      return Response.json({ error: "Não autorizado." }, { status: 401 });

    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const action = clean(body?.action, 60);

    if (action === "createUser") {
      const name = clean(body?.name, 160);
      const email = clean(body?.email, 254).toLowerCase();
      const password = typeof body?.password === "string" ? body.password : "";
      const requestedRaw =
        typeof body?.roleCodigo === "string"
          ? body.roleCodigo
          : typeof body?.role === "string"
            ? body.role
            : "VISITANTE";
      const roleFromAuth: Record<string, RoleCodigo> = {
        admin: "ADMINISTRADOR",
        staff: "STAFF",
        avaliador: "AVALIADOR",
        professor: "PROFESSOR",
        visitante: "VISITANTE",
        aluno: "ALUNO",
        participante: "PARTICIPANTE",
        visitor: "VISITANTE",
        ADMINISTRADOR: "ADMINISTRADOR",
        STAFF: "STAFF",
        AVALIADOR: "AVALIADOR",
        PROFESSOR: "PROFESSOR",
        VISITANTE: "VISITANTE",
        ALUNO: "ALUNO",
        PARTICIPANTE: "PARTICIPANTE",
      };
      const roleCodigo = roleFromAuth[requestedRaw] ?? "VISITANTE";
      const telefone = onlyDigits(String(body?.telefone ?? "81999999999"));
      const cpf = onlyDigits(String(body?.cpf ?? ""));
      const dataNascimento =
        clean(body?.dataNascimento, 10) || "1990-01-01";
      const estado = normalizeEstado(String(body?.estado ?? ""));
      const cidade = normalizeCidade(String(body?.cidade ?? ""));

      const roleRow = await getRoleByCodigo(roleCodigo);
      if (!roleRow) {
        return Response.json({ error: "Função inválida." }, { status: 400 });
      }

      if (!estado) {
        return Response.json(
          { error: "Selecione o estado." },
          { status: 400 },
        );
      }
      if (cidade.length < 2) {
        return Response.json(
          { error: "Informe a cidade." },
          { status: 400 },
        );
      }

      if (
        name.length < 2 ||
        !isEmail(email) ||
        !isStrongPassword(password) ||
        !cpf ||
        !isValidCpf(cpf)
      ) {
        return Response.json(
          {
            error: "Informe nome, e-mail, CPF válido e senha forte.",
          },
          { status: 400 },
        );
      }

      const existing = await query<{ id: number }>(
        "SELECT id FROM usuarios WHERE lower(email) = $1 LIMIT 1",
        [email],
      );
      if (existing.rows[0]) {
        return Response.json(
          { error: "Este e-mail já está em uso." },
          { status: 409 },
        );
      }
      const existingCpf = await query<{ id: number }>(
        "SELECT id FROM usuarios WHERE cpf = $1 LIMIT 1",
        [cpf],
      );
      if (existingCpf.rows[0]) {
        return Response.json(
          { error: "Este CPF já está em uso." },
          { status: 409 },
        );
      }

      const qrCodeHash = createQrCodeHash();
      const senhaHash = await hashPassword(password);
      await query(
        `INSERT INTO usuarios
          (role_id, nome_completo, email, telefone, cpf, senha_hash,
           data_nascimento, estado, cidade, aceitou_direito_imagem,
           data_aceite_direito_imagem, qr_code_hash, ativo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, NOW(3), $10, TRUE)`,
        [
          roleRow.id,
          name,
          email,
          telefone,
          cpf,
          senhaHash,
          dataNascimento,
          estado,
          cidade,
          qrCodeHash,
        ],
      );
      const created = await query<{ id: number }>(
        "SELECT id FROM usuarios WHERE email = $1 LIMIT 1",
        [email],
      );
      const userId = String(created.rows[0]?.id ?? "");
      const user = (await readSnctStore()).users.find(
        (candidate) => candidate.id === userId,
      );
      await recordAuditEvent(request, {
        actorId: session.userId,
        actorRole: session.role,
        action:
          roleCodigo === "ADMINISTRADOR"
            ? "user.create_admin"
            : roleCodigo === "STAFF"
              ? "user.create_staff"
              : "user.create",
        entity: "usuario",
        entityId: userId,
        metadata: { role: roleCodigo },
      });
      return Response.json({ user });
    }

    if (action === "updateUser") {
      const userId = clean(body?.userId, 100);
      const name = clean(body?.name, 160);
      const email = clean(body?.email, 254).toLowerCase();
      const telefone = onlyDigits(String(body?.telefone ?? ""));
      const cpf = onlyDigits(String(body?.cpf ?? ""));
      const dataNascimento = clean(body?.dataNascimento, 10);
      const estado = normalizeEstado(String(body?.estado ?? ""));
      const cidade = normalizeCidade(String(body?.cidade ?? ""));
      const password =
        typeof body?.password === "string" ? body.password.trim() : "";
      const requestedRaw =
        typeof body?.roleCodigo === "string"
          ? body.roleCodigo
          : typeof body?.role === "string"
            ? body.role
            : "";
      const roleFromAuth: Record<string, RoleCodigo> = {
        admin: "ADMINISTRADOR",
        staff: "STAFF",
        avaliador: "AVALIADOR",
        professor: "PROFESSOR",
        visitante: "VISITANTE",
        aluno: "ALUNO",
        participante: "PARTICIPANTE",
        ADMINISTRADOR: "ADMINISTRADOR",
        STAFF: "STAFF",
        AVALIADOR: "AVALIADOR",
        PROFESSOR: "PROFESSOR",
        VISITANTE: "VISITANTE",
        ALUNO: "ALUNO",
        PARTICIPANTE: "PARTICIPANTE",
      };
      const roleCodigo = roleFromAuth[requestedRaw];

      if (
        !userId ||
        name.length < 2 ||
        !isEmail(email) ||
        !cpf ||
        !isValidCpf(cpf) ||
        !telefone ||
        !/^\d{4}-\d{2}-\d{2}$/.test(dataNascimento) ||
        !estado ||
        cidade.length < 2 ||
        !roleCodigo
      ) {
        return Response.json(
          {
            error:
              "Informe nome, e-mail, CPF, telefone, data de nascimento, cidade, estado e perfil válidos.",
          },
          { status: 400 },
        );
      }
      if (password && !isStrongPassword(password)) {
        return Response.json(
          {
            error:
              "A nova senha precisa ter no mínimo 12 caracteres, com maiúscula, minúscula, número e símbolo.",
          },
          { status: 400 },
        );
      }

      const existing = await query<{ id: number; role_codigo: RoleCodigo }>(
        `SELECT u.id, r.codigo AS role_codigo
         FROM usuarios u
         INNER JOIN roles r ON r.id = u.role_id
         WHERE u.id = $1 LIMIT 1`,
        [userId],
      );
      const current = existing.rows[0];
      if (!current) {
        return Response.json({ error: "Usuário não encontrado." }, { status: 404 });
      }

      const emailTaken = await query<{ id: number }>(
        "SELECT id FROM usuarios WHERE lower(email) = $1 AND id <> $2 LIMIT 1",
        [email, userId],
      );
      if (emailTaken.rows[0]) {
        return Response.json(
          { error: "Este e-mail já está em uso." },
          { status: 409 },
        );
      }
      const cpfTaken = await query<{ id: number }>(
        "SELECT id FROM usuarios WHERE cpf = $1 AND id <> $2 LIMIT 1",
        [cpf, userId],
      );
      if (cpfTaken.rows[0]) {
        return Response.json(
          { error: "Este CPF já está em uso." },
          { status: 409 },
        );
      }

      if (password) {
        const senhaHash = await hashPassword(password);
        await query(
          `UPDATE usuarios
           SET nome_completo = $2, email = $3, telefone = $4,
               cpf = $5, data_nascimento = $6, estado = $7, cidade = $8,
               senha_hash = $9
           WHERE id = $1`,
          [
            userId,
            name,
            email,
            telefone,
            cpf,
            dataNascimento,
            estado,
            cidade,
            senhaHash,
          ],
        );
      } else {
        await query(
          `UPDATE usuarios
           SET nome_completo = $2, email = $3, telefone = $4,
               cpf = $5, data_nascimento = $6, estado = $7, cidade = $8
           WHERE id = $1`,
          [userId, name, email, telefone, cpf, dataNascimento, estado, cidade],
        );
      }

      if (current.role_codigo !== roleCodigo) {
        await changeUserRole({
          usuarioId: userId,
          novaRoleCodigo: roleCodigo,
          alteradoPorUsuarioId: session.userId,
          motivo: "Alteração via edição de perfil no painel",
          request,
        });
      }

      const user = (await readSnctStore()).users.find(
        (item) => item.id === userId,
      );
      await recordAuditEvent(request, {
        actorId: session.userId,
        actorRole: session.role,
        action: "user.update",
        entity: "usuario",
        entityId: userId,
        metadata: { role: roleCodigo, passwordChanged: Boolean(password) },
      });
      return Response.json({ user });
    }

    if (action === "changeRole") {
      const userId = clean(body?.userId, 100);
      const roleCodigo = clean(body?.roleCodigo, 32) as RoleCodigo;
      const motivo = clean(body?.motivo, 255);
      try {
        const result = await changeUserRole({
          usuarioId: userId,
          novaRoleCodigo: roleCodigo,
          alteradoPorUsuarioId: session.userId,
          motivo,
          request,
        });
        const user = (await readSnctStore()).users.find((item) => item.id === userId);
        return Response.json({ user, ...result });
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : "Falha ao alterar função." },
          { status: 400 },
        );
      }
    }

    if (action === "setActive") {
      const userId = clean(body?.userId, 100);
      const ativo = body?.ativo === true;
      try {
        await setUserActive({
          usuarioId: userId,
          ativo,
          alteradoPorUsuarioId: session.userId,
          request,
        });
        const user = (await readSnctStore()).users.find((item) => item.id === userId);
        return Response.json({ user });
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : "Falha ao atualizar status." },
          { status: 400 },
        );
      }
    }

    if (action === "deleteUser") {
      const userId = clean(body?.userId, 100);
      const existing = await query<{ id: number }>(
        `SELECT u.id FROM usuarios u
         INNER JOIN roles r ON r.id = u.role_id
         WHERE u.id = $1 AND r.codigo <> 'ADMINISTRADOR'`,
        [userId],
      );
      if (!existing.rows[0]) {
        return Response.json(
          { error: "Usuário não encontrado ou protegido." },
          { status: 404 },
        );
      }
      await query("DELETE FROM usuarios WHERE id = $1", [userId]);
      await recordAuditEvent(request, {
        actorId: session.userId,
        actorRole: session.role,
        action: "user.delete",
        entity: "usuario",
        entityId: userId,
      });
      return Response.json({ success: true });
    }

    if (action === "saveEvent") {
      const normalizedDate = normalizeEventDate(clean(body?.date, 30));
      const time = clean(body?.time, 20);
      const event: ManagedEvent = {
        id: clean(body?.id, 100) || `event-${randomUUID()}`,
        date: normalizedDate ?? "",
        time: /^\d{2}:\d{2}$/.test(time) ? time : "",
        title: clean(body?.title, 220),
        location: clean(body?.location, 180),
      };
      if (!normalizedDate) {
        return Response.json(
          {
            error:
              "Informe a data completa do evento no formato dia/mês/ano (ex.: 29/07/2026).",
          },
          { status: 400 },
        );
      }
      if (!event.time || !event.title || !event.location) {
        return Response.json(
          { error: "Preencha todos os dados do evento." },
          { status: 400 },
        );
      }
      await updateSnctStore((store) => {
        const index = store.events.findIndex((item) => item.id === event.id);
        if (index >= 0) store.events[index] = event;
        else store.events.push(event);
      });
      await recordAuditEvent(request, {
        actorId: session.userId,
        actorRole: session.role,
        action: "event.save",
        entity: "event",
        entityId: event.id,
      });
      return Response.json({ event });
    }

    if (action === "deleteEvent") {
      const id = clean(body?.id, 100);
      await updateSnctStore((store) => {
        store.events = store.events.filter((event) => event.id !== id);
      });
      await recordAuditEvent(request, {
        actorId: session.userId,
        actorRole: session.role,
        action: "event.delete",
        entity: "event",
        entityId: id,
      });
      return Response.json({ success: true });
    }

    if (action === "deleteNotice") {
      const id = clean(body?.id, 100);
      const storageNames = await updateSnctStore<string[]>((store) => {
        const notice = store.notices.find((item) => item.id === id);
        store.notices = store.notices.filter((item) => item.id !== id);
        return notice?.documents.map((document) => document.storageName) ?? [];
      });
      await Promise.all(storageNames.map(deleteNoticeDocumentFile));
      await recordAuditEvent(request, {
        actorId: session.userId,
        actorRole: session.role,
        action: "notice.delete",
        entity: "notice",
        entityId: id,
      });
      return Response.json({ success: true });
    }

    if (action === "deleteNoticeDocument") {
      const noticeId = clean(body?.noticeId, 100);
      const documentId = clean(body?.documentId, 100);
      const storageName = await updateSnctStore<string | undefined>((store) => {
        const notice = store.notices.find((item) => item.id === noticeId);
        const document = notice?.documents.find(
          (item) => item.id === documentId,
        );
        if (notice)
          notice.documents = notice.documents.filter(
            (item) => item.id !== documentId,
          );
        return document?.storageName;
      });
      if (storageName) await deleteNoticeDocumentFile(storageName);
      await recordAuditEvent(request, {
        actorId: session.userId,
        actorRole: session.role,
        action: "document.delete",
        entity: "document",
        entityId: documentId,
      });
      return Response.json({ success: true });
    }

    if (action === "addPartner") {
      return Response.json(
        {
          error:
            "Envie a logomarca como arquivo pelo formulário de parceiros.",
        },
        { status: 400 },
      );
    }

    if (action === "deletePartner") {
      const id = clean(body?.id, 100);
      const removed = await updateSnctStore<ManagedPartner | undefined>(
        (store) => {
          const partner = store.partners.find((item) => item.id === id);
          store.partners = store.partners.filter((item) => item.id !== id);
          return partner;
        },
      );
      if (removed?.logo) await deletePartnerLogoFile(removed.logo);
      await recordAuditEvent(request, {
        actorId: session.userId,
        actorRole: session.role,
        action: "partner.delete",
        entity: "partner",
        entityId: id,
      });
      return Response.json({ success: true });
    }

    if (action === "togglePartnerHidden") {
      const id = clean(body?.id, 100);
      const updated = await updateSnctStore<ManagedPartner | undefined>(
        (store) => {
          const partner = store.partners.find((item) => item.id === id);
          if (!partner) return undefined;
          partner.hidden = !partner.hidden;
          return partner;
        },
      );
      if (!updated) {
        return Response.json(
          { error: "Parceiro não encontrado." },
          { status: 404 },
        );
      }
      await recordAuditEvent(request, {
        actorId: session.userId,
        actorRole: session.role,
        action: updated.hidden ? "partner.hide" : "partner.show",
        entity: "partner",
        entityId: id,
        metadata: { hidden: Boolean(updated.hidden) },
      });
      return Response.json({ partner: updated });
    }

    if (action === "updateSettings") {
      const eventEdition = clean(body?.eventEdition, 100);
      const heroImageUrl = clean(body?.heroImageUrl, 600);
      if (!eventEdition || !isAllowedImageUrl(heroImageUrl)) {
        return Response.json(
          {
            error: "Preencha a edição e use uma imagem de domínio autorizado.",
          },
          { status: 400 },
        );
      }
      await updateSnctStore((store) => {
        store.settings = { ...store.settings, eventEdition, heroImageUrl };
      });
      await recordAuditEvent(request, {
        actorId: session.userId,
        actorRole: session.role,
        action: "settings.update",
        entity: "settings",
        entityId: "1",
      });
      return Response.json({ settings: { eventEdition, heroImageUrl } });
    }

    if (action === "updatePalette") {
      const palette = {
        background: clean(body?.background, 7),
        surface: clean(body?.surface, 7),
        primary: clean(body?.primary, 7),
        secondary: clean(body?.secondary, 7),
        accent: clean(body?.accent, 7),
        text: clean(body?.text, 7),
      };
      if (!Object.values(palette).every(isHexColor)) {
        return Response.json(
          { error: "Use cores válidas no formato hexadecimal #RRGGBB." },
          { status: 400 },
        );
      }
      await updateSnctStore((store) => {
        store.settings = { ...store.settings, palette };
      });
      await recordAuditEvent(request, {
        actorId: session.userId,
        actorRole: session.role,
        action: "palette.update",
        entity: "settings",
        entityId: "1",
        metadata: palette,
      });
      return Response.json({ palette });
    }

    if (action === "saveGameForm") {
      const title = clean(body?.title, 180);
      const slug = clean(body?.slug, 100)
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const description = clean(body?.description, 2000);
      const fields = Array.isArray(body?.fields) ? body.fields.slice(0, 30) : [];
      const normalizedFields = fields.flatMap((raw, index) => {
        if (!raw || typeof raw !== "object") return [];
        const field = raw as Record<string, unknown>;
        const label = clean(field.label, 120);
        const type = clean(field.type, 20);
        if (
          !label ||
          !["text", "email", "number", "select", "textarea", "checkbox"].includes(
            type,
          )
        ) {
          return [];
        }
        return [
          {
            id: clean(field.id, 64) || `field-${index + 1}`,
            label,
            type,
            required: Boolean(field.required),
            options: Array.isArray(field.options)
              ? field.options.map((item) => clean(item, 80)).filter(Boolean)
              : [],
          },
        ];
      });
      if (!title || !slug || !normalizedFields.length) {
        return Response.json(
          { error: "Informe título, identificador e ao menos um campo válido." },
          { status: 400 },
        );
      }
      const id = clean(body?.id, 64) || `game-form-${randomUUID()}`;
      const form = await prisma.gameForm.upsert({
        where: { id },
        create: {
          id,
          title,
          slug,
          description: description || null,
          fields: normalizedFields,
        },
        update: {
          title,
          slug,
          description: description || null,
          fields: normalizedFields,
        },
      });
      await recordAuditEvent(request, {
        actorId: session.userId,
        actorRole: session.role,
        action: "game_form.save",
        entity: "game_form",
        entityId: form.id,
      });
      return Response.json({ form });
    }

    if (action === "deleteGameForm") {
      const id = clean(body?.id, 64);
      await prisma.gameForm.delete({ where: { id } });
      await recordAuditEvent(request, {
        actorId: session.userId,
        actorRole: session.role,
        action: "game_form.delete",
        entity: "game_form",
        entityId: id,
      });
      return Response.json({ ok: true });
    }

    if (action === "createEstande") {
      const result = await createEstande({
        codigo: clean(body?.codigo, 40),
        status: (clean(body?.status, 32) || "DISPONIVEL") as EstandeStatus,
      });
      if (!result.ok) {
        return Response.json({ error: result.error }, { status: result.status });
      }
      await recordAuditEvent(request, {
        actorId: session.userId,
        actorRole: session.role,
        action: "estande.create",
        entity: "estande",
        entityId: result.estande.id,
        dadosNovos: result.estande as unknown as Record<string, unknown>,
      });
      const estandes = await listEstandes();
      return Response.json({ estande: result.estande, estandes });
    }

    if (action === "updateEstande") {
      const estandeId = clean(body?.estandeId, 64);
      const statusRaw = clean(body?.status, 32);
      const result = await updateEstande(estandeId, {
        codigo: clean(body?.codigo, 40) || undefined,
        status: statusRaw
          ? (statusRaw as EstandeStatus)
          : undefined,
      });
      if (!result.ok) {
        return Response.json({ error: result.error }, { status: result.status });
      }
      await recordAuditEvent(request, {
        actorId: session.userId,
        actorRole: session.role,
        action: "estande.update",
        entity: "estande",
        entityId: estandeId,
        dadosNovos: result.estande as unknown as Record<string, unknown>,
      });
      const estandes = await listEstandes();
      return Response.json({ estande: result.estande, estandes });
    }

    if (action === "deleteEstande") {
      const estandeId = clean(body?.estandeId, 64);
      const result = await deleteEstande(estandeId);
      if (!result.ok) {
        return Response.json({ error: result.error }, { status: result.status });
      }
      await recordAuditEvent(request, {
        actorId: session.userId,
        actorRole: session.role,
        action: "estande.delete",
        entity: "estande",
        entityId: estandeId,
      });
      const estandes = await listEstandes();
      return Response.json({ success: true, estandes });
    }

    if (action === "aprovarProjeto") {
      const projetoId = clean(body?.projetoId, 64);
      const estandeId = clean(body?.estandeId, 64);
      if (!projetoId || !estandeId) {
        return Response.json(
          { error: "Informe o projeto e o stand disponível." },
          { status: 400 },
        );
      }
      const result = await aprovarProjeto(projetoId, estandeId);
      if (!result.ok) {
        return Response.json({ error: result.error }, { status: result.status });
      }
      await recordAuditEvent(request, {
        actorId: session.userId,
        actorRole: session.role,
        action: "projeto.aprovar",
        entity: "projeto",
        entityId: projetoId,
        dadosNovos: {
          estandeId,
          status: "APROVADO",
        },
      });
      const [projetos, estandes] = await Promise.all([
        listProjetosAdmin(),
        listEstandes(),
      ]);
      return Response.json({ success: true, projetos, estandes });
    }

    if (action === "rejeitarProjeto") {
      const projetoId = clean(body?.projetoId, 64);
      const result = await rejeitarProjeto(projetoId);
      if (!result.ok) {
        return Response.json({ error: result.error }, { status: result.status });
      }
      await recordAuditEvent(request, {
        actorId: session.userId,
        actorRole: session.role,
        action: "projeto.rejeitar",
        entity: "projeto",
        entityId: projetoId,
        dadosAnteriores: {
          estandeId: result.previousEstandeId,
        },
        dadosNovos: { status: "REJEITADO" },
      });
      const [projetos, estandes] = await Promise.all([
        listProjetosAdmin(),
        listEstandes(),
      ]);
      return Response.json({ success: true, projetos, estandes });
    }

    if (action === "cancelarAprovacaoProjeto") {
      const projetoId = clean(body?.projetoId, 64);
      const result = await cancelarAprovacaoProjeto(projetoId);
      if (!result.ok) {
        return Response.json({ error: result.error }, { status: result.status });
      }
      await recordAuditEvent(request, {
        actorId: session.userId,
        actorRole: session.role,
        action: "projeto.cancelar_aprovacao",
        entity: "projeto",
        entityId: projetoId,
        dadosAnteriores: {
          estandeId: result.previousEstandeId,
          status: "APROVADO",
        },
        dadosNovos: { status: "PENDENTE", estandeId: null },
      });
      const [projetos, estandes] = await Promise.all([
        listProjetosAdmin(),
        listEstandes(),
      ]);
      return Response.json({ success: true, projetos, estandes });
    }

    return Response.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error) {
    return securityErrorResponse(error);
  }
}
