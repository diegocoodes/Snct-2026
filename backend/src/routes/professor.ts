import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  createAluno,
  createTema,
  deleteAluno,
  deleteEscola,
  deleteTema,
  getAlunoDocumentoForProfessor,
  getProfessorPanel,
  updateTema,
  upsertEscola,
} from "@/lib/professor";
import {
  assertTrustedMutation,
  enforceRateLimit,
  securityErrorResponse,
} from "@/lib/request-security";

export async function GET(request: Request) {
  try {
    const session = await requireRole("professor");
    if (!session) {
      return Response.json({ error: "Não autorizado." }, { status: 401 });
    }

    const url = new URL(request.url);
    const documentId = url.searchParams.get("documentId");
    if (documentId) {
      const document = await getAlunoDocumentoForProfessor(
        documentId,
        session.userId,
      );
      if (!document) {
        return Response.json(
          { error: "Documento não encontrado." },
          { status: 404 },
        );
      }
      return new Response(new Uint8Array(document.file), {
        headers: {
          "Cache-Control": "no-store",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(document.name)}`,
          "Content-Security-Policy": "default-src 'none'; sandbox",
          "Content-Length": String(document.file.byteLength),
          "Content-Type": document.mimeType,
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    const panel = await getProfessorPanel(
      session.userId,
      url.searchParams.get("escolaId"),
    );
    return Response.json(panel);
  } catch (error) {
    return securityErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    const session = await requireRole("professor");
    if (!session) {
      return Response.json({ error: "Não autorizado." }, { status: 401 });
    }

    await enforceRateLimit({
      request,
      scope: "professor-mutate",
      identifier: session.userId,
      limit: 40,
      windowSeconds: 60,
    });

    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const action = String(form.get("action") ?? "");

      if (action !== "createAluno") {
        return Response.json({ error: "Ação inválida." }, { status: 400 });
      }

      const temaId = String(form.get("temaId") ?? "");
      const foto = form.get("foto");
      let fotoBuffer: Buffer | null = null;
      if (foto instanceof File && foto.size > 0) {
        fotoBuffer = Buffer.from(await foto.arrayBuffer());
      }

      const autorizacaoFiles: File[] = [];
      for (const item of form.getAll("autorizacao")) {
        if (typeof item !== "string" && item.size > 0) {
          autorizacaoFiles.push(item as File);
        }
      }

      const result = await createAluno(temaId, session.userId, {
        nomeCompleto: String(form.get("nomeCompleto") ?? ""),
        email: String(form.get("email") ?? ""),
        telefone: String(form.get("telefone") ?? ""),
        cpf: String(form.get("cpf") ?? ""),
        dataNascimento: String(form.get("dataNascimento") ?? ""),
        aceitouDireitoImagem:
          form.get("aceitouDireitoImagem") === "true" ||
          form.get("aceitouDireitoImagem") === "on",
        privacyConsent:
          form.get("privacyConsent") === "true" ||
          form.get("privacyConsent") === "on",
        guardianConsent:
          form.get("guardianConsent") === "true" ||
          form.get("guardianConsent") === "on",
        fotoBuffer,
        autorizacaoFiles,
      });

      if (!result.ok) {
        return Response.json({ error: result.error }, { status: result.status });
      }

      const temaEscola = await query<{ escola_id: number }>(
        `SELECT escola_id FROM professor_temas WHERE id = $1 LIMIT 1`,
        [temaId],
      ).catch(() => ({ rows: [] as { escola_id: number }[] }));

      const panel = await getProfessorPanel(
        session.userId,
        temaEscola.rows[0] ? String(temaEscola.rows[0].escola_id) : null,
      );
      return Response.json({ ok: true, aluno: result.aluno, ...panel });
    }

    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const action = typeof body?.action === "string" ? body.action : "";

    if (action === "saveEscola") {
      const escolaId =
        typeof body?.escolaId === "string" ? body.escolaId : undefined;
      const result = await upsertEscola(session.userId, {
        nome: typeof body?.nome === "string" ? body.nome : "",
        cidade: "Paulista",
        escolaId,
      });
      if (!result.ok) {
        return Response.json({ error: result.error }, { status: result.status });
      }
      const panel = await getProfessorPanel(session.userId, result.escola.id);
      return Response.json({ ok: true, ...panel });
    }

    if (action === "createTema") {
      const escolaId =
        typeof body?.escolaId === "string" ? body.escolaId : "";
      const panelBefore = await getProfessorPanel(session.userId, escolaId || null);
      if (!panelBefore.escola) {
        return Response.json(
          { error: "Cadastre a escola antes de criar projetos." },
          { status: 400 },
        );
      }
      if (escolaId && panelBefore.escola.id !== escolaId) {
        return Response.json(
          { error: "Escola inválida para este professor." },
          { status: 404 },
        );
      }
      const result = await createTema(panelBefore.escola.id, {
        titulo: typeof body?.titulo === "string" ? body.titulo : "",
        area: typeof body?.area === "string" ? body.area : "",
        descricao:
          typeof body?.descricao === "string" ? body.descricao : undefined,
      });
      if (!result.ok) {
        return Response.json({ error: result.error }, { status: result.status });
      }
      const panel = await getProfessorPanel(
        session.userId,
        panelBefore.escola.id,
      );
      return Response.json({ ok: true, tema: result.tema, ...panel });
    }

    if (action === "updateTema") {
      const temaId = typeof body?.temaId === "string" ? body.temaId : "";
      if (!temaId) {
        return Response.json({ error: "Projeto inválido." }, { status: 400 });
      }
      const result = await updateTema(temaId, session.userId, {
        titulo: typeof body?.titulo === "string" ? body.titulo : "",
        area: typeof body?.area === "string" ? body.area : "",
        descricao:
          typeof body?.descricao === "string" ? body.descricao : undefined,
      });
      if (!result.ok) {
        return Response.json({ error: result.error }, { status: result.status });
      }
      const panel = await getProfessorPanel(session.userId);
      return Response.json({ ok: true, ...panel });
    }

    return Response.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error) {
    return securityErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertTrustedMutation(request);
    const session = await requireRole("professor");
    if (!session) {
      return Response.json({ error: "Não autorizado." }, { status: 401 });
    }

    await enforceRateLimit({
      request,
      scope: "professor-delete",
      identifier: session.userId,
      limit: 40,
      windowSeconds: 60,
    });

    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const action = typeof body?.action === "string" ? body.action : "";

    if (action === "deleteTema") {
      const temaId = typeof body?.temaId === "string" ? body.temaId : "";
      if (!temaId) {
        return Response.json({ error: "Projeto inválido." }, { status: 400 });
      }
      const result = await deleteTema(temaId, session.userId);
      if (!result.ok) {
        return Response.json({ error: result.error }, { status: result.status });
      }
      const panel = await getProfessorPanel(session.userId);
      return Response.json({ ok: true, ...panel });
    }

    if (action === "deleteEscola") {
      const escolaId =
        typeof body?.escolaId === "string" ? body.escolaId : undefined;
      const result = await deleteEscola(session.userId, escolaId);
      if (!result.ok) {
        return Response.json({ error: result.error }, { status: result.status });
      }
      const panel = await getProfessorPanel(session.userId);
      return Response.json({ ok: true, ...panel });
    }

    if (action === "deleteAluno") {
      const alunoId = typeof body?.alunoId === "string" ? body.alunoId : "";
      if (!alunoId) {
        return Response.json({ error: "Aluno inválido." }, { status: 400 });
      }
      const result = await deleteAluno(alunoId, session.userId);
      if (!result.ok) {
        return Response.json({ error: result.error }, { status: result.status });
      }
      const panel = await getProfessorPanel(session.userId);
      return Response.json({ ok: true, ...panel });
    }

    return Response.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error) {
    return securityErrorResponse(error);
  }
}
