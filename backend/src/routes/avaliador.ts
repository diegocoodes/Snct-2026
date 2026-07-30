import { requireRole } from "@/lib/auth";
import {
  AVALIACAO_CRITERIOS,
  AVALIACAO_TOTAL_MAXIMO,
  ESCALA_DESEMPENHO,
  getAvaliacaoDoAvaliadorPorStand,
  getReservaAtivaDoStand,
  getStandParaAvaliacao,
  JA_AVALIADO_MSG,
  listAvaliacoesDoAvaliador,
  salvarAvaliacao,
  selecionarProximoStand,
} from "@/lib/avaliacoes";
import {
  assertTrustedMutation,
  enforceRateLimit,
  securityErrorResponse,
} from "@/lib/request-security";
import {
  concederTitulacao,
  getTitulacoesDoDia,
  listTitulacaoCategorias,
} from "@/lib/titulacoes";

export async function GET_CRITERIOS(request: Request) {
  try {
    const session = await requireRole("avaliador", "admin");
    if (!session) {
      return Response.json({ error: "Não autorizado." }, { status: 401 });
    }
    return Response.json({
      criterios: AVALIACAO_CRITERIOS,
      totalMaximo: AVALIACAO_TOTAL_MAXIMO,
      escalaDesempenho: ESCALA_DESEMPENHO,
    });
  } catch (error) {
    return securityErrorResponse(error);
  }
}

export async function GET_MINHAS_AVALIACOES(request: Request) {
  try {
    const session = await requireRole("avaliador", "admin");
    if (!session) {
      return Response.json({ error: "Não autorizado." }, { status: 401 });
    }
    const avaliacoes = await listAvaliacoesDoAvaliador(session.userId);
    return Response.json({ avaliacoes });
  } catch (error) {
    return securityErrorResponse(error);
  }
}

export async function GET_TITULACOES(request: Request) {
  try {
    const session = await requireRole("avaliador", "admin");
    if (!session) {
      return Response.json({ error: "Não autorizado." }, { status: 401 });
    }
    const titulacoes = await getTitulacoesDoDia(session.userId);
    return Response.json({
      ...titulacoes,
      categorias: listTitulacaoCategorias(),
    });
  } catch (error) {
    return securityErrorResponse(error);
  }
}

export async function POST_TITULACAO(request: Request) {
  try {
    assertTrustedMutation(request);
    const session = await requireRole("avaliador", "admin");
    if (!session) {
      return Response.json({ error: "Não autorizado." }, { status: 401 });
    }
    await enforceRateLimit({
      request,
      scope: "avaliador-titulacao",
      identifier: session.userId,
      limit: 30,
      windowSeconds: 60,
    });

    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const alunoId = typeof body?.alunoId === "string" ? body.alunoId : "";
    const standId = typeof body?.standId === "string" ? body.standId : "";
    const projetoId =
      typeof body?.projetoId === "string" ? body.projetoId : "";
    const categoria =
      typeof body?.categoria === "string" ? body.categoria : "";

    if (!alunoId || !standId || !projetoId || !categoria) {
      return Response.json(
        { error: "Informe aluno, stand, projeto e categoria." },
        { status: 400 },
      );
    }

    const result = await concederTitulacao({
      avaliadorUsuarioId: session.userId,
      alunoId,
      standId,
      projetoId,
      categoria,
    });
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    const titulacoes = await getTitulacoesDoDia(session.userId);
    return Response.json({
      ok: true,
      titulacao: result.titulacao,
      ...titulacoes,
    });
  } catch (error) {
    return securityErrorResponse(error);
  }
}

export async function POST_COMECAR_AVALIACAO(request: Request) {
  try {
    assertTrustedMutation(request);
    const session = await requireRole("avaliador", "admin");
    if (!session) {
      return Response.json({ error: "Não autorizado." }, { status: 401 });
    }
    await enforceRateLimit({
      request,
      scope: "avaliador-comecar",
      identifier: session.userId,
      limit: 20,
      windowSeconds: 60,
    });
    const stand = await selecionarProximoStand(session.userId);
    if (!stand) {
      return Response.json(
        {
          error:
            "Não há stands aptos para distribuição agora. Todos os disponíveis já foram avaliados por você, estão reservados, inativos ou no limite de avaliações.",
        },
        { status: 404 },
      );
    }
    return Response.json({ stand });
  } catch (error) {
    return securityErrorResponse(error);
  }
}

/** Mantido por compatibilidade com clientes antigos. */
export async function GET_STAND_SORTEADO(request: Request) {
  try {
    const session = await requireRole("avaliador", "admin");
    if (!session) {
      return Response.json({ error: "Não autorizado." }, { status: 401 });
    }
    await enforceRateLimit({
      request,
      scope: "avaliador-comecar",
      identifier: session.userId,
      limit: 20,
      windowSeconds: 60,
    });
    const stand = await selecionarProximoStand(session.userId);
    if (!stand) {
      return Response.json(
        {
          error:
            "Não há stands aptos para distribuição agora. Todos os disponíveis já foram avaliados por você, estão reservados, inativos ou no limite de avaliações.",
        },
        { status: 404 },
      );
    }
    return Response.json({ stand });
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

    if (result.stand.status === "INATIVO") {
      return Response.json(
        { error: "Este stand não está disponível para avaliação." },
        { status: 400 },
      );
    }

    const avaliacao = await getAvaliacaoDoAvaliadorPorStand(
      session.userId,
      result.stand.id,
    );

    if (avaliacao) {
      return Response.json(
        {
          error: JA_AVALIADO_MSG,
          jaAvaliado: true,
          stand: result.stand,
          projeto: result.projeto,
          avaliacao,
        },
        { status: 409 },
      );
    }

    const reserva = await getReservaAtivaDoStand(result.stand.id);
    if (reserva && reserva.avaliadorUsuarioId !== session.userId) {
      return Response.json(
        {
          error: "Este stand está reservado para outro avaliador.",
          reservado: true,
        },
        { status: 409 },
      );
    }

    const titulacoes = await getTitulacoesDoDia(session.userId);

    return Response.json({
      stand: result.stand,
      projeto: result.projeto,
      criterios: AVALIACAO_CRITERIOS,
      totalMaximo: AVALIACAO_TOTAL_MAXIMO,
      escalaDesempenho: ESCALA_DESEMPENHO,
      titulacoes,
      avaliacao: null,
      jaAvaliado: false,
      reservaExpiraEm: reserva?.expiresAt ?? null,
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
