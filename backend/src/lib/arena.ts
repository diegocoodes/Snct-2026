import { randomBytes } from "node:crypto";

import { recordAuditEvent } from "@/lib/audit";
import { isValidCpf, onlyDigits } from "@/lib/cpf";
import { clientExecute, clientQuery, query, transaction } from "@/lib/db";
import {
  normalizeCidade,
  normalizeEstado,
} from "@/lib/estados-brasil";
import { hashPassword } from "@/lib/password";
import { getRoleByCodigo, ROLE_CODIGO_TO_AUTH } from "@/lib/roles";
import type { RoleCodigo } from "@/lib/snct-types";
import {
  createQrCodeHash,
  parseBirthDate,
} from "@/lib/usuarios";

export const ARENA_JOGOS = ["LOL", "VALORANT", "FREE_FIRE"] as const;
export type ArenaJogo = (typeof ARENA_JOGOS)[number];

export const ARENA_JOGO_LABELS: Record<ArenaJogo, string> = {
  LOL: "League of Legends",
  VALORANT: "Valorant",
  FREE_FIRE: "Free Fire",
};

export const ARENA_TEAM_SIZE = 5;
export const ARENA_SOLO_SIZE = 1;
/** Máximo de times completos por campeonato (LoL e Valorant). */
export const ARENA_MAX_TIMES_EQUIPE = (() => {
  const value = Number(process.env.SNCT_ARENA_MAX_TIMES ?? 10);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 10;
})();

export const ARENA_TEAM_SIZE_BY_JOGO: Record<ArenaJogo, number> = {
  LOL: ARENA_TEAM_SIZE,
  VALORANT: ARENA_TEAM_SIZE,
  FREE_FIRE: ARENA_SOLO_SIZE,
};

export function isArenaSolo(jogo: ArenaJogo) {
  return ARENA_TEAM_SIZE_BY_JOGO[jogo] === ARENA_SOLO_SIZE;
}

/** LoL e Valorant têm teto de times; Free Fire (individual) não. */
export function getMaxInscricoesPorJogo(jogo: ArenaJogo) {
  return isArenaSolo(jogo) ? null : ARENA_MAX_TIMES_EQUIPE;
}

export type ArenaMembroInput = {
  nomeCompleto: string;
  email: string;
  telefone: string;
  cpf: string;
  dataNascimento: string;
  estado: string;
  cidade: string;
  nick: string;
};

export type ArenaTimeInput = {
  nomeTime: string;
  jogo: string;
  membros: ArenaMembroInput[];
  aceitouDireitoImagem: boolean;
  privacyConsent: boolean;
  guardianConsent?: boolean;
};

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function toId(value: number | bigint | string) {
  return String(value);
}

function isArenaJogo(value: string): value is ArenaJogo {
  return (ARENA_JOGOS as readonly string[]).includes(value);
}

type UsuarioLookup = {
  id: number;
  email: string;
  cpf: string;
  role_codigo: RoleCodigo;
};

async function findUsuarioByCpf(cpf: string) {
  const result = await query<UsuarioLookup>(
    `SELECT u.id, u.email, u.cpf, r.codigo AS role_codigo
     FROM usuarios u
     INNER JOIN roles r ON r.id = u.role_id
     WHERE u.cpf = $1
     LIMIT 1`,
    [cpf],
  );
  return result.rows[0] ?? null;
}

async function findUsuarioByEmail(email: string) {
  const result = await query<UsuarioLookup>(
    `SELECT u.id, u.email, u.cpf, r.codigo AS role_codigo
     FROM usuarios u
     INNER JOIN roles r ON r.id = u.role_id
     WHERE lower(u.email) = $1
     LIMIT 1`,
    [email],
  );
  return result.rows[0] ?? null;
}

async function usuarioJaNoJogo(usuarioId: string, jogo: ArenaJogo) {
  const result = await query<{ id: number }>(
    `SELECT m.id
     FROM arena_time_membros m
     INNER JOIN arena_times t ON t.id = m.time_id
     WHERE m.usuario_id = $1 AND t.jogo = $2
     LIMIT 1`,
    [usuarioId, jogo],
  );
  return Boolean(result.rows[0]);
}

export async function countInscricoesPorJogo(jogo: ArenaJogo) {
  const result = await query<{ total: number | string }>(
    `SELECT COUNT(*) AS total FROM arena_times WHERE jogo = $1`,
    [jogo],
  );
  return Number(result.rows[0]?.total ?? 0);
}

export async function getVagasArena() {
  const rows = await Promise.all(
    ARENA_JOGOS.map(async (jogo) => {
      const inscritos = await countInscricoesPorJogo(jogo);
      const limite = getMaxInscricoesPorJogo(jogo);
      const restante =
        limite === null ? null : Math.max(0, limite - inscritos);
      return {
        jogo,
        jogoLabel: ARENA_JOGO_LABELS[jogo],
        solo: isArenaSolo(jogo),
        inscritos,
        limite,
        restante,
        esgotado: limite !== null && inscritos >= limite,
      };
    }),
  );
  return { jogos: rows, maxTimesEquipe: ARENA_MAX_TIMES_EQUIPE };
}

export async function registrarTimeArena(
  input: ArenaTimeInput,
  request?: Request,
) {
  let nomeTime = input.nomeTime.trim();
  const jogoRaw = input.jogo.trim().toUpperCase();

  if (!isArenaJogo(jogoRaw)) {
    return {
      ok: false as const,
      status: 400,
      error: "Selecione um campeonato válido: LoL, Valorant ou Free Fire.",
    };
  }

  const teamSize = ARENA_TEAM_SIZE_BY_JOGO[jogoRaw];
  const solo = isArenaSolo(jogoRaw);
  const membroLabel = solo ? "Participante" : "Integrante";

  if (!input.aceitouDireitoImagem) {
    return {
      ok: false as const,
      status: 400,
      error: "É obrigatório aceitar o direito de uso de imagem.",
    };
  }
  if (!input.privacyConsent) {
    return {
      ok: false as const,
      status: 400,
      error: "Aceite o aviso de privacidade para continuar.",
    };
  }
  if (!Array.isArray(input.membros) || input.membros.length !== teamSize) {
    return {
      ok: false as const,
      status: 400,
      error: solo
        ? "A inscrição no Free Fire é individual: informe exatamente 1 participante."
        : `A equipe deve ter exatamente ${teamSize} participantes.`,
    };
  }

  if (solo && nomeTime.length < 2) {
    const nickSolo = String(input.membros[0]?.nick ?? "").trim();
    nomeTime = nickSolo.length >= 2 ? nickSolo : "";
  }

  if (nomeTime.length < 2 || nomeTime.length > 120) {
    return {
      ok: false as const,
      status: 400,
      error: solo
        ? "Informe o nick no jogo (usado como identificação da inscrição)."
        : "Informe o nome do time (2 a 120 caracteres).",
    };
  }

  const limiteTimes = getMaxInscricoesPorJogo(jogoRaw);
  if (limiteTimes !== null) {
    const inscritos = await countInscricoesPorJogo(jogoRaw);
    if (inscritos >= limiteTimes) {
      return {
        ok: false as const,
        status: 409,
        error: `As vagas de times para ${ARENA_JOGO_LABELS[jogoRaw]} esgotaram (máximo de ${limiteTimes} times).`,
      };
    }
  }

  const role = await getRoleByCodigo("PARTICIPANTE");
  if (!role) {
    return {
      ok: false as const,
      status: 500,
      error: "Função PARTICIPANTE não configurada.",
    };
  }

  type PreparedMember = {
    ordem: number;
    nomeCompleto: string;
    email: string;
    telefone: string;
    cpf: string;
    birthIso: string;
    age: number;
    estado: string;
    cidade: string;
    nick: string;
    existingId: string | null;
    created: boolean;
  };

  const prepared: PreparedMember[] = [];
  const seenCpfs = new Set<string>();
  const seenEmails = new Set<string>();
  let hasMinor = false;

  for (let index = 0; index < input.membros.length; index += 1) {
    const raw = input.membros[index];
    const ordem = index + 1;
    const nomeCompleto = String(raw?.nomeCompleto ?? "").trim();
    const email = String(raw?.email ?? "").trim().toLowerCase();
    const telefone = onlyDigits(String(raw?.telefone ?? ""));
    const cpf = onlyDigits(String(raw?.cpf ?? ""));
    const nick = String(raw?.nick ?? "").trim();
    const birth = parseBirthDate(String(raw?.dataNascimento ?? "").trim());
    const estado = normalizeEstado(String(raw?.estado ?? ""));
    const cidade = normalizeCidade(String(raw?.cidade ?? ""));

    const prefix = solo ? membroLabel : `${membroLabel} ${ordem}`;

    if (nomeCompleto.length < 2) {
      return {
        ok: false as const,
        status: 400,
        error: `${prefix}: informe o nome completo.`,
      };
    }
    if (!isEmail(email)) {
      return {
        ok: false as const,
        status: 400,
        error: `${prefix}: informe um e-mail válido.`,
      };
    }
    if (telefone.length < 10 || telefone.length > 11) {
      return {
        ok: false as const,
        status: 400,
        error: `${prefix}: informe um telefone válido.`,
      };
    }
    if (!isValidCpf(cpf)) {
      return {
        ok: false as const,
        status: 400,
        error: `${prefix}: informe um CPF válido.`,
      };
    }
    if (!birth) {
      return {
        ok: false as const,
        status: 400,
        error: `${prefix}: informe uma data de nascimento válida.`,
      };
    }
    if (!estado) {
      return {
        ok: false as const,
        status: 400,
        error: `${prefix}: selecione o estado.`,
      };
    }
    if (cidade.length < 2) {
      return {
        ok: false as const,
        status: 400,
        error: `${prefix}: informe a cidade.`,
      };
    }
    if (nick.length < 2 || nick.length > 80) {
      return {
        ok: false as const,
        status: 400,
        error: `${prefix}: informe o nick no jogo (2 a 80 caracteres).`,
      };
    }
    if (seenCpfs.has(cpf)) {
      return {
        ok: false as const,
        status: 400,
        error: "Há CPFs duplicados entre os integrantes do time.",
      };
    }
    if (seenEmails.has(email)) {
      return {
        ok: false as const,
        status: 400,
        error: "Há e-mails duplicados entre os integrantes do time.",
      };
    }
    seenCpfs.add(cpf);
    seenEmails.add(email);
    if (birth.age < 18) hasMinor = true;

    const byCpf = await findUsuarioByCpf(cpf);
    const byEmail = await findUsuarioByEmail(email);

    if (byCpf && byEmail && toId(byCpf.id) !== toId(byEmail.id)) {
      return {
        ok: false as const,
        status: 409,
        error: `${prefix}: CPF e e-mail pertencem a usuários diferentes.`,
      };
    }

    if (!byCpf && byEmail) {
      return {
        ok: false as const,
        status: 409,
        error: `${prefix}: este e-mail já está em uso por outro CPF.`,
      };
    }

    if (byCpf && byCpf.email.toLowerCase() !== email) {
      return {
        ok: false as const,
        status: 409,
        error: `${prefix}: este CPF já está cadastrado com outro e-mail.`,
      };
    }

    const existing = byCpf;
    if (existing && (await usuarioJaNoJogo(toId(existing.id), jogoRaw))) {
      return {
        ok: false as const,
        status: 409,
        error: solo
          ? "Você já está inscrito neste campeonato."
          : `${prefix}: já está inscrito em outro time deste campeonato.`,
      };
    }

    prepared.push({
      ordem,
      nomeCompleto,
      email,
      telefone,
      cpf,
      birthIso: birth.iso,
      age: birth.age,
      estado,
      cidade,
      nick,
      existingId: existing ? toId(existing.id) : null,
      created: !existing,
    });
  }

  if (hasMinor && !input.guardianConsent) {
    return {
      ok: false as const,
      status: 400,
      error: solo
        ? "O consentimento do responsável é obrigatório para menores de idade."
        : "Há menor(es) de idade no time. O consentimento do responsável é obrigatório.",
    };
  }

  try {
    const result = await transaction(async (client) => {
      const memberIds: { ordem: number; usuarioId: string; created: boolean; nick: string }[] =
        [];

      for (const member of prepared) {
        let usuarioId = member.existingId;
        if (!usuarioId) {
          const senhaHash = await hashPassword(
            `P!${randomBytes(24).toString("base64url")}`,
          );
          const qrCodeHash = createQrCodeHash();
          const inserted = await clientExecute(
            client,
            `INSERT INTO usuarios
              (role_id, nome_completo, email, telefone, cpf, senha_hash,
               data_nascimento, estado, cidade, aceitou_direito_imagem,
               data_aceite_direito_imagem, qr_code_hash, ativo)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, NOW(3), $10, TRUE)`,
            [
              role.id,
              member.nomeCompleto,
              member.email,
              member.telefone,
              member.cpf,
              senhaHash,
              member.birthIso,
              member.estado,
              member.cidade,
              qrCodeHash,
            ],
          );
          if (!inserted.insertId) {
            throw new Error("Falha ao criar participante.");
          }
          usuarioId = toId(inserted.insertId);
        } else {
          await clientExecute(
            client,
            `UPDATE usuarios
             SET estado = $2, cidade = $3, telefone = $4
             WHERE id = $1`,
            [usuarioId, member.estado, member.cidade, member.telefone],
          );
        }

        memberIds.push({
          ordem: member.ordem,
          usuarioId,
          created: member.created,
          nick: member.nick,
        });
      }

      const responsavelId = memberIds[0]?.usuarioId;
      if (!responsavelId) {
        throw new Error("Time sem responsável.");
      }

      if (limiteTimes !== null) {
        const countInside = await clientQuery<{ total: number | string }>(
          client,
          `SELECT COUNT(*) AS total FROM arena_times WHERE jogo = $1`,
          [jogoRaw],
        );
        const atuais = Number(countInside.rows[0]?.total ?? 0);
        if (atuais >= limiteTimes) {
          throw new Error(
            `As vagas de times para ${ARENA_JOGO_LABELS[jogoRaw]} esgotaram (máximo de ${limiteTimes} times).`,
          );
        }
      }

      const timeInsert = await clientExecute(
        client,
        `INSERT INTO arena_times (nome, jogo, responsavel_usuario_id)
         VALUES ($1, $2, $3)`,
        [nomeTime, jogoRaw, responsavelId],
      );
      const timeId = toId(timeInsert.insertId);
      if (!timeId || timeId === "0") {
        throw new Error("Falha ao criar o time.");
      }

      for (const member of memberIds) {
        await clientExecute(
          client,
          `INSERT INTO arena_time_membros (time_id, usuario_id, nick, ordem)
           VALUES ($1, $2, $3, $4)`,
          [timeId, member.usuarioId, member.nick, member.ordem],
        );
      }

      return { timeId, responsavelId, memberIds };
    });

    const responsavel = await query<{
      id: number;
      nome_completo: string;
      qr_code_hash: string;
    }>(
      `SELECT id, nome_completo, qr_code_hash
       FROM usuarios WHERE id = $1 LIMIT 1`,
      [result.responsavelId],
    );
    const captain = responsavel.rows[0];

    if (request) {
      await recordAuditEvent(request, {
        actorId: result.responsavelId,
        actorRole: ROLE_CODIGO_TO_AUTH.PARTICIPANTE,
        action: "arena.team.register",
        entity: "arena_time",
        entityId: result.timeId,
        metadata: {
          jogo: jogoRaw,
          nomeTime,
          solo,
          createdUsers: result.memberIds.filter((m) => m.created).length,
          linkedUsers: result.memberIds.filter((m) => !m.created).length,
        },
      });
    }

    return {
      ok: true as const,
      time: {
        id: result.timeId,
        nome: nomeTime,
        jogo: jogoRaw,
        jogoLabel: ARENA_JOGO_LABELS[jogoRaw],
        solo,
        membros: result.memberIds.map((m) => ({
          ordem: m.ordem,
          usuarioId: m.usuarioId,
          nick: m.nick,
          criado: m.created,
        })),
      },
      responsavel: {
        id: result.responsavelId,
        nomeCompleto: captain?.nome_completo ?? prepared[0]?.nomeCompleto ?? "",
        qrCodeHash: captain?.qr_code_hash ?? "",
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Não foi possível cadastrar o time.";
    if (/vagas de times.*esgotaram/i.test(message)) {
      return { ok: false as const, status: 409, error: message };
    }
    return { ok: false as const, status: 500, error: message };
  }
}
