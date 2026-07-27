import { requireRole } from "@/lib/auth";
import {
  AVALIACAO_CRITERIOS,
  getAvaliacaoDoAvaliador,
  getStandParaAvaliacao,
  salvarAvaliacao,
} from "@/lib/avaliacoes";
import {
  assertTrustedMutation,
  enforceRateLimit,
  securityErrorResponse,
} from "@/lib/request-security";

export async function GET_CRITERIOS(request: Request) {
  try {
    const session = await requireRole("avaliador", "admin");
    if (!session) {
      return Response.json({ error: "Não autorizado." }, { status: 401 });
    }
    return Response.json({ criterios: AVALIACAO_CRITERIOS });
  } catch (error) {
    return securityErrorResponse(error);
  }
}

export async function GET_STAND(request: Request, qrCodeHash: string) {
  try {
    const session = await requireRole("avaliador", "admin");
    if (!session) {
      return Response.json({ error: "Não autorizado." }, { status: 401 });
    }

    await enforceRateLimit({
      request,
      scope: "avaliador-stand",
      identifier: session.userId,
      limit: 60,
      windowSeconds: 60,
    });

    const result = await getStandParaAvaliacao(decodeURIComponent(qrCodeHash));
    if (!result) {
      return Response.json({ error: "Stand não encontrado." }, { status: 404 });
    }
    if (!result.ok) {
      return Response.json(
        { error: result.error, stand: result.stand },
        { status: result.status },
      );
    }

    const avaliacao = await getAvaliacaoDoAvaliador(
      session.userId,
      result.projeto.id,
    );

    return Response.json({
      stand: result.stand,
      projeto: result.projeto,
      criterios: AVALIACAO_CRITERIOS,
      avaliacao,
    });
  } catch (error) {
    return securityErrorResponse(error);
  }
}

export async function POST_AVALIACAO(request: Request) {
  try {
    assertTrustedMutation(request);
    const session = await requireRole("avaliador", "admin");
    if (!session) {
      return Response.json({ error: "Não autorizado." }, { status: 401 });
    }

    await enforceRateLimit({
      request,
      scope: "avaliador-avaliar",
      identifier: session.userId,
      limit: 30,
      windowSeconds: 60,
    });

    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;

    const standId = typeof body?.standId === "string" ? body.standId : "";
    const projetoId =
      typeof body?.projetoId === "string" ? body.projetoId : "";
    const notas =
      body?.notas && typeof body.notas === "object"
        ? (body.notas as Record<string, unknown>)
        : null;
    const observacoes =
      typeof body?.observacoes === "string" ? body.observacoes : "";

    if (!standId || !projetoId || !notas) {
      return Response.json(
        { error: "Informe stand, projeto e as notas da ficha." },
        { status: 400 },
      );
    }

    const result = await salvarAvaliacao({
      avaliadorUsuarioId: session.userId,
      standId,
      projetoId,
      notas,
      observacoes,
    });

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json({ ok: true, avaliacao: result.avaliacao });
  } catch (error) {
    return securityErrorResponse(error);
  }
}
