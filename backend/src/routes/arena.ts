import {
  assertTrustedMutation,
  enforceRateLimit,
  securityErrorResponse,
} from "@/lib/request-security";
import { registrarTimeArena, type ArenaMembroInput } from "@/lib/arena";

function parseBoolean(value: unknown) {
  return value === true || value === "true" || value === "on";
}

function parseMembros(raw: unknown): ArenaMembroInput[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const row = (item ?? {}) as Record<string, unknown>;
    return {
      nomeCompleto: String(row.nomeCompleto ?? row.name ?? ""),
      email: String(row.email ?? ""),
      telefone: String(row.telefone ?? ""),
      cpf: String(row.cpf ?? ""),
      dataNascimento: String(row.dataNascimento ?? ""),
      nick: String(row.nick ?? ""),
    };
  });
}

export async function POST_ARENA_TIME(request: Request) {
  try {
    assertTrustedMutation(request);
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;

    const nomeTime = String(body?.nomeTime ?? body?.nome ?? "");
    const jogo = String(body?.jogo ?? "");
    const membros = parseMembros(body?.membros);

    await enforceRateLimit({
      request,
      scope: "register-arena-time",
      identifier: nomeTime || request.headers.get("x-forwarded-for") || "anon",
      limit: 3,
      windowSeconds: 10 * 60,
    });

    const result = await registrarTimeArena(
      {
        nomeTime,
        jogo,
        membros,
        aceitouDireitoImagem: parseBoolean(body?.aceitouDireitoImagem),
        privacyConsent: parseBoolean(body?.privacyConsent),
        guardianConsent: parseBoolean(body?.guardianConsent),
      },
      request,
    );

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json(
      {
        time: result.time,
        user: {
          id: result.responsavel.id,
          nomeCompleto: result.responsavel.nomeCompleto,
          role: "participante",
          roleCodigo: "PARTICIPANTE",
          qrCodeHash: result.responsavel.qrCodeHash,
        },
        qrCodeHash: result.responsavel.qrCodeHash,
        message: "Time inscrito com sucesso na Arena Gamer.",
      },
      { status: 201 },
    );
  } catch (error) {
    return securityErrorResponse(error);
  }
}
