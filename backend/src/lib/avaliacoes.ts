import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const AVALIACAO_CRITERIOS = [
  {
    key: "cPerguntaObjetivos",
    codigo: "1",
    label: "Pergunta e objetivos",
    descricao: "Clareza do problema e coerência dos objetivos",
    maximo: 10,
  },
  {
    key: "cProcessoInvestigativo",
    codigo: "2",
    label: "Processo investigativo",
    descricao:
      "Observação, teste, pesquisa, registros e adequação do método à idade",
    maximo: 20,
  },
  {
    key: "cAutoriaProtagonismo",
    codigo: "3",
    label: "Autoria e protagonismo",
    descricao: "Participação real dos estudantes e domínio do que foi realizado",
    maximo: 20,
  },
  {
    key: "cEvidenciasAprendizagem",
    codigo: "4",
    label: "Evidências e aprendizagem",
    descricao:
      "Uso de dados, registros, resultados e reconhecimento de limites",
    maximo: 15,
  },
  {
    key: "cCriatividadeInovacao",
    codigo: "5",
    label: "Criatividade e inovação",
    descricao: "Originalidade da abordagem ou adaptação ao contexto",
    maximo: 10,
  },
  {
    key: "cImpactoResponsabilidade",
    codigo: "6",
    label: "Impacto e responsabilidade",
    descricao:
      "Relevância para escola/comunidade, segurança, ética e sustentabilidade",
    maximo: 10,
  },
  {
    key: "cComunicacaoCientifica",
    codigo: "7",
    label: "Comunicação científica",
    descricao:
      "Clareza, escuta, organização do estande e qualidade do banner",
    maximo: 10,
  },
  {
    key: "cIntegracaoCienciaDelas",
    codigo: "8",
    label: "Integração ao tema Ciência Delas",
    descricao:
      "Vínculo consistente com mulheres, meninas e equidade na ciência",
    maximo: 5,
  },
] as const;

export const AVALIACAO_TOTAL_MAXIMO = AVALIACAO_CRITERIOS.reduce(
  (sum, item) => sum + item.maximo,
  0,
);

export const ESCALA_DESEMPENHO = [
  {
    nivel: "Excelente",
    faixa: "90% a 100% do item",
    referencia:
      "Evidência clara, consistente e autônoma, adequada à faixa etária.",
  },
  {
    nivel: "Bom",
    faixa: "70% a 89%",
    referencia:
      "Evidência suficiente, com pequenas lacunas que não comprometem a compreensão.",
  },
  {
    nivel: "Em desenvolvimento",
    faixa: "40% a 69%",
    referencia:
      "Evidência parcial; a equipe demonstra aprendizagem, mas há lacunas relevantes.",
  },
  {
    nivel: "Inicial",
    faixa: "0% a 39%",
    referencia:
      "Evidência insuficiente, incoerente, não apresentada ou não atribuível aos estudantes.",
  },
] as const;

export type CriterioKey = (typeof AVALIACAO_CRITERIOS)[number]["key"];

export type NotasAvaliacao = Record<CriterioKey, number>;

const JA_AVALIADO_MSG = "Você já realizou a avaliação deste stand.";

function toId(value: number | bigint | string) {
  return String(value);
}

function parseNota(value: unknown, maximo: number, label: string): number {
  if (value === null || value === undefined || value === "") {
    throw new Error(`Informe a nota de "${label}" (0 a ${maximo}).`);
  }
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 0 || n > maximo) {
    throw new Error(`A nota de "${label}" deve ser um inteiro de 0 a ${maximo}.`);
  }
  return n;
}

function mapAvaliacaoRow(row: {
  id: bigint;
  standId: bigint;
  projetoId: bigint;
  tentativa: number;
  cPerguntaObjetivos: number;
  cProcessoInvestigativo: number;
  cAutoriaProtagonismo: number;
  cEvidenciasAprendizagem: number;
  cCriatividadeInovacao: number;
  cImpactoResponsabilidade: number;
  cComunicacaoCientifica: number;
  cIntegracaoCienciaDelas: number;
  total: number;
  observacoes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: toId(row.id),
    standId: toId(row.standId),
    projetoId: toId(row.projetoId),
    tentativa: row.tentativa,
    status: "CONCLUIDA" as const,
    notas: {
      cPerguntaObjetivos: row.cPerguntaObjetivos,
      cProcessoInvestigativo: row.cProcessoInvestigativo,
      cAutoriaProtagonismo: row.cAutoriaProtagonismo,
      cEvidenciasAprendizagem: row.cEvidenciasAprendizagem,
      cCriatividadeInovacao: row.cCriatividadeInovacao,
      cImpactoResponsabilidade: row.cImpactoResponsabilidade,
      cComunicacaoCientifica: row.cComunicacaoCientifica,
      cIntegracaoCienciaDelas: row.cIntegracaoCienciaDelas,
    } satisfies NotasAvaliacao,
    total: row.total,
    observacoes: row.observacoes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function calcularTotal(notas: NotasAvaliacao) {
  return AVALIACAO_CRITERIOS.reduce((sum, item) => sum + notas[item.key], 0);
}

export async function getStandParaAvaliacao(qrCodeHash: string) {
  const hash = qrCodeHash.trim();
  if (!hash) return null;

  const stand = await prisma.stand.findUnique({
    where: { qrCodeHash: hash },
    include: {
      projeto: {
        include: {
          escola: {
            include: {
              professor: {
                select: { id: true, nomeCompleto: true, email: true },
              },
            },
          },
          alunos: {
            select: {
              id: true,
              nomeCompleto: true,
              usuarioId: true,
              usuario: { select: { dataNascimento: true } },
            },
            orderBy: { nomeCompleto: "asc" },
            take: 4,
          },
        },
      },
    },
  });

  if (!stand) return null;

  const projeto = stand.projeto;
  if (!projeto || projeto.status !== "APROVADO") {
    return {
      ok: false as const,
      status: 400,
      error:
        "Este stand ainda não possui projeto aprovado para avaliação.",
      stand: {
        id: toId(stand.id),
        codigo: stand.codigo,
        status: stand.status,
        qrCodeHash: stand.qrCodeHash,
      },
    };
  }

  function ageFromBirth(value: Date) {
    const iso = value.toISOString().slice(0, 10);
    const [y, m, d] = iso.split("-").map(Number);
    const now = new Date();
    let age = now.getFullYear() - y;
    if (
      now.getMonth() + 1 < m ||
      (now.getMonth() + 1 === m && now.getDate() < d)
    ) {
      age -= 1;
    }
    return age;
  }

  return {
    ok: true as const,
    stand: {
      id: toId(stand.id),
      codigo: stand.codigo,
      nome: stand.nome,
      status: stand.status,
      qrCodeHash: stand.qrCodeHash,
    },
    projeto: {
      id: toId(projeto.id),
      titulo: projeto.titulo,
      area: projeto.area,
      descricao: projeto.descricao,
      status: projeto.status,
      instituicao: projeto.escola.nome,
      professor: {
        id: toId(projeto.escola.professor.id),
        nomeCompleto: projeto.escola.professor.nomeCompleto,
        email: projeto.escola.professor.email,
      },
      alunos: projeto.alunos.map((aluno) => {
        const age = ageFromBirth(aluno.usuario.dataNascimento);
        return {
          id: toId(aluno.id),
          usuarioId: toId(aluno.usuarioId),
          nomeCompleto: aluno.nomeCompleto,
          idade: age,
        };
      }),
    },
  };
}

/** Abre stand já avaliado pelo avaliador apenas para conceder titulações. */
export async function getStandParaTitulacao(
  avaliadorUsuarioId: string,
  standId: string,
) {
  const id = standId.trim();
  if (!id || !/^\d+$/.test(id)) return null;

  const avaliacao = await prisma.avaliacao.findUnique({
    where: {
      avaliadorUsuarioId_standId: {
        avaliadorUsuarioId: BigInt(avaliadorUsuarioId),
        standId: BigInt(id),
      },
    },
  });
  if (!avaliacao) {
    return {
      ok: false as const,
      status: 403,
      error:
        "Só é possível premiar títulos em stands que você já avaliou.",
    };
  }

  const stand = await prisma.stand.findUnique({
    where: { id: BigInt(id) },
    include: {
      projeto: {
        include: {
          escola: {
            include: {
              professor: {
                select: { id: true, nomeCompleto: true, email: true },
              },
            },
          },
          alunos: {
            select: {
              id: true,
              nomeCompleto: true,
              usuarioId: true,
              usuario: { select: { dataNascimento: true } },
            },
            orderBy: { nomeCompleto: "asc" },
            take: 4,
          },
        },
      },
    },
  });

  if (!stand?.projeto || stand.projeto.status !== "APROVADO") {
    return {
      ok: false as const,
      status: 404,
      error: "Stand ou projeto não encontrado.",
    };
  }

  function ageFromBirth(value: Date) {
    const iso = value.toISOString().slice(0, 10);
    const [y, m, d] = iso.split("-").map(Number);
    const now = new Date();
    let age = now.getFullYear() - y;
    if (
      now.getMonth() + 1 < m ||
      (now.getMonth() + 1 === m && now.getDate() < d)
    ) {
      age -= 1;
    }
    return age;
  }

  const projeto = stand.projeto;
  return {
    ok: true as const,
    stand: {
      id: toId(stand.id),
      codigo: stand.codigo,
      nome: stand.nome,
      status: stand.status,
      qrCodeHash: stand.qrCodeHash,
    },
    projeto: {
      id: toId(projeto.id),
      titulo: projeto.titulo,
      area: projeto.area,
      descricao: projeto.descricao,
      status: projeto.status,
      instituicao: projeto.escola.nome,
      professor: {
        id: toId(projeto.escola.professor.id),
        nomeCompleto: projeto.escola.professor.nomeCompleto,
        email: projeto.escola.professor.email,
      },
      alunos: projeto.alunos.map((aluno) => {
        const age = ageFromBirth(aluno.usuario.dataNascimento);
        return {
          id: toId(aluno.id),
          usuarioId: toId(aluno.usuarioId),
          nomeCompleto: aluno.nomeCompleto,
          idade: age,
        };
      }),
    },
    avaliacaoId: toId(avaliacao.id),
  };
}

export async function getAvaliacaoDoAvaliadorPorStand(
  avaliadorUsuarioId: string,
  standId: string,
) {
  const row = await prisma.avaliacao.findUnique({
    where: {
      avaliadorUsuarioId_standId: {
        avaliadorUsuarioId: BigInt(avaliadorUsuarioId),
        standId: BigInt(standId),
      },
    },
  });
  return row ? mapAvaliacaoRow(row) : null;
}

/** @deprecated Prefer getAvaliacaoDoAvaliadorPorStand */
export async function getAvaliacaoDoAvaliador(
  avaliadorUsuarioId: string,
  projetoId: string,
) {
  const row = await prisma.avaliacao.findFirst({
    where: {
      avaliadorUsuarioId: BigInt(avaliadorUsuarioId),
      projetoId: BigInt(projetoId),
    },
    orderBy: { createdAt: "desc" },
  });
  return row ? mapAvaliacaoRow(row) : null;
}

export async function listAvaliacoesDoAvaliador(avaliadorUsuarioId: string) {
  const rows = await prisma.avaliacao.findMany({
    where: { avaliadorUsuarioId: BigInt(avaliadorUsuarioId) },
    include: {
      stand: {
        select: { id: true, codigo: true, nome: true },
      },
      projeto: {
        select: { id: true, titulo: true, area: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) => ({
    id: toId(row.id),
    standId: toId(row.standId),
    standCodigo: row.stand.codigo,
    standNome: row.stand.nome || row.stand.codigo,
    projetoId: toId(row.projetoId),
    projetoTitulo: row.projeto.titulo,
    projetoTema: row.projeto.area,
    total: row.total,
    status: "CONCLUIDA" as const,
    statusLabel: "Concluída",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

/** Visão admin: todos os avaliadores e os trabalhos que cada um avaliou. */
export async function listAvaliadoresComAvaliacoesAdmin() {
  const avaliadores = await prisma.usuario.findMany({
    where: { role: { codigo: "AVALIADOR" } },
    select: {
      id: true,
      nomeCompleto: true,
      email: true,
      telefone: true,
      cpf: true,
      ativo: true,
      createdAt: true,
      avaliacoes: {
        include: {
          stand: { select: { id: true, codigo: true, nome: true } },
          projeto: {
            select: {
              id: true,
              titulo: true,
              area: true,
              escola: { select: { nome: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { nomeCompleto: "asc" },
  });

  return avaliadores.map((avaliador) => {
    const trabalhos = avaliador.avaliacoes.map((row) => ({
      id: toId(row.id),
      standId: toId(row.standId),
      standCodigo: row.stand.codigo,
      standNome: row.stand.nome || row.stand.codigo,
      projetoId: toId(row.projetoId),
      projetoTitulo: row.projeto.titulo,
      projetoArea: row.projeto.area,
      escolaNome: row.projeto.escola?.nome ?? null,
      total: row.total,
      totalMaximo: AVALIACAO_TOTAL_MAXIMO,
      observacoes: row.observacoes,
      criterios: {
        cPerguntaObjetivos: row.cPerguntaObjetivos,
        cProcessoInvestigativo: row.cProcessoInvestigativo,
        cAutoriaProtagonismo: row.cAutoriaProtagonismo,
        cEvidenciasAprendizagem: row.cEvidenciasAprendizagem,
        cCriatividadeInovacao: row.cCriatividadeInovacao,
        cImpactoResponsabilidade: row.cImpactoResponsabilidade,
        cComunicacaoCientifica: row.cComunicacaoCientifica,
        cIntegracaoCienciaDelas: row.cIntegracaoCienciaDelas,
      },
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));

    const metaMinima = getMinAvaliacoesPorAvaliador();
    return {
      id: toId(avaliador.id),
      nomeCompleto: avaliador.nomeCompleto,
      email: avaliador.email,
      telefone: avaliador.telefone,
      cpf: avaliador.cpf,
      ativo: avaliador.ativo,
      createdAt: avaliador.createdAt.toISOString(),
      avaliacoesCount: trabalhos.length,
      metaMinima,
      metaAtingida: trabalhos.length >= metaMinima,
      trabalhos,
    };
  });
}

/** Minutos de exclusividade da reserva do stand. */
export function getReservaMinutos() {
  const value = Number(process.env.SNCT_AVALIACAO_RESERVA_MINUTOS ?? 25);
  return Number.isFinite(value) && value > 0 ? value : 25;
}

/** Limite máximo de avaliações por stand (organização). */
export function getMaxAvaliacoesPorStand() {
  const value = Number(process.env.SNCT_MAX_AVALIACOES_POR_STAND ?? 3);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 3;
}

/** Meta mínima de stands que cada avaliador deve avaliar. */
export function getMinAvaliacoesPorAvaliador() {
  const value = Number(process.env.SNCT_MIN_AVALIACOES_POR_AVALIADOR ?? 18);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 18;
}

async function limparReservasExpiradas(now = new Date()) {
  await prisma.avaliadorStandSorteio.deleteMany({
    where: { expiresAt: { lte: now } },
  });
}

export async function getReservaAtivaDoStand(standId: string) {
  await limparReservasExpiradas();
  const row = await prisma.avaliadorStandSorteio.findUnique({
    where: { standId: BigInt(standId) },
  });
  if (!row) return null;
  if (row.expiresAt.getTime() <= Date.now()) {
    await prisma.avaliadorStandSorteio
      .delete({ where: { id: row.id } })
      .catch(() => undefined);
    return null;
  }
  return {
    standId: toId(row.standId),
    avaliadorUsuarioId: toId(row.avaliadorUsuarioId),
    expiresAt: row.expiresAt.toISOString(),
  };
}

async function liberarReservaDoStand(standId: bigint | string) {
  await prisma.avaliadorStandSorteio
    .deleteMany({ where: { standId: BigInt(standId) } })
    .catch(() => undefined);
}

/**
 * Algoritmo de seleção do próximo stand:
 * aptos = não avaliados pelo avaliador + sem reserva de outro +
 * abaixo do limite + ativos com projeto aprovado.
 * Prioriza o menor número de avaliações; empate = aleatório.
 * Reserva exclusiva por até 25 minutos.
 */
export async function selecionarProximoStand(
  avaliadorUsuarioId: string,
  tentativa = 0,
) {
  if (tentativa > 5) return null;

  const avaliadorId = BigInt(avaliadorUsuarioId);
  const agora = new Date();
  const reservaMinutos = getReservaMinutos();
  const maxAvaliacoes = getMaxAvaliacoesPorStand();
  const expiresAt = new Date(agora.getTime() + reservaMinutos * 60_000);

  await limparReservasExpiradas(agora);

  const reservaAtual = await prisma.avaliadorStandSorteio.findFirst({
    where: {
      avaliadorUsuarioId: avaliadorId,
      expiresAt: { gt: agora },
    },
    include: {
      stand: {
        include: {
          projeto: {
            select: {
              titulo: true,
              status: true,
              escola: {
                select: {
                  nome: true,
                  professor: { select: { nomeCompleto: true } },
                },
              },
            },
          },
          _count: { select: { avaliacoes: true } },
        },
      },
    },
  });

  if (reservaAtual) {
    const jaAvaliou = await prisma.avaliacao.findUnique({
      where: {
        avaliadorUsuarioId_standId: {
          avaliadorUsuarioId: avaliadorId,
          standId: reservaAtual.standId,
        },
      },
      select: { id: true },
    });
    const stand = reservaAtual.stand;
    const aindaApto =
      !jaAvaliou &&
      stand.status !== "INATIVO" &&
      stand.projeto?.status === "APROVADO" &&
      stand._count.avaliacoes < maxAvaliacoes;

    if (aindaApto) {
      return {
        id: toId(stand.id),
        codigo: stand.codigo,
        nome: stand.nome,
        projetoTitulo: stand.projeto?.titulo ?? null,
        escolaNome: stand.projeto?.escola.nome ?? null,
        professorNome: stand.projeto?.escola.professor.nomeCompleto ?? null,
        totalAvaliacoes: stand._count.avaliacoes,
        qrCodeHash: stand.qrCodeHash,
        reservaExpiraEm: reservaAtual.expiresAt.toISOString(),
        reservaMinutos,
        maxAvaliacoesPorStand: maxAvaliacoes,
        reutilizada: true,
      };
    }

    await liberarReservaDoStand(reservaAtual.standId);
  }

  const jaAvaliados = await prisma.avaliacao.findMany({
    where: { avaliadorUsuarioId: avaliadorId },
    select: { standId: true },
  });
  const excluidos = new Set(jaAvaliados.map((item) => toId(item.standId)));

  const reservasAtivas = await prisma.avaliadorStandSorteio.findMany({
    where: { expiresAt: { gt: agora } },
    select: { standId: true, avaliadorUsuarioId: true },
  });
  for (const reserva of reservasAtivas) {
    if (toId(reserva.avaliadorUsuarioId) !== avaliadorUsuarioId) {
      excluidos.add(toId(reserva.standId));
    }
  }

  const candidatos = await prisma.stand.findMany({
    where: {
      status: { not: "INATIVO" },
      projeto: { is: { status: "APROVADO" } },
      ...(excluidos.size
        ? { id: { notIn: [...excluidos].map((id) => BigInt(id)) } }
        : {}),
    },
    include: {
      _count: { select: { avaliacoes: true } },
      projeto: {
        select: {
          titulo: true,
          escola: {
            select: {
              nome: true,
              professor: { select: { nomeCompleto: true } },
            },
          },
        },
      },
    },
  });

  const aptos = candidatos.filter(
    (item) => item._count.avaliacoes < maxAvaliacoes,
  );
  if (!aptos.length) return null;

  const menorCarga = Math.min(...aptos.map((item) => item._count.avaliacoes));
  const equilibrados = aptos.filter(
    (item) => item._count.avaliacoes === menorCarga,
  );
  const stand = equilibrados[Math.floor(Math.random() * equilibrados.length)];

  try {
    await prisma.$transaction(async (tx) => {
      await tx.avaliadorStandSorteio.deleteMany({
        where: {
          OR: [
            { expiresAt: { lte: agora } },
            { avaliadorUsuarioId: avaliadorId },
            { standId: stand.id },
          ],
        },
      });
      await tx.avaliadorStandSorteio.create({
        data: {
          avaliadorUsuarioId: avaliadorId,
          standId: stand.id,
          expiresAt,
        },
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // Concorrência: outro avaliador reservou no mesmo instante.
      return selecionarProximoStand(avaliadorUsuarioId, tentativa + 1);
    }
    throw error;
  }

  return {
    id: toId(stand.id),
    codigo: stand.codigo,
    nome: stand.nome,
    projetoTitulo: stand.projeto?.titulo ?? null,
    escolaNome: stand.projeto?.escola.nome ?? null,
    professorNome: stand.projeto?.escola.professor.nomeCompleto ?? null,
    totalAvaliacoes: stand._count.avaliacoes,
    qrCodeHash: stand.qrCodeHash,
    reservaExpiraEm: expiresAt.toISOString(),
    reservaMinutos,
    maxAvaliacoesPorStand: maxAvaliacoes,
    reutilizada: false,
  };
}

/** @deprecated Use selecionarProximoStand */
export async function sortearStandParaAvaliador(avaliadorUsuarioId: string) {
  return selecionarProximoStand(avaliadorUsuarioId);
}

export async function salvarAvaliacao(input: {
  avaliadorUsuarioId: string;
  standId: string;
  projetoId: string;
  notas: Record<string, unknown>;
  observacoes?: string;
}) {
  let notas: NotasAvaliacao;
  try {
    const parsed = {} as NotasAvaliacao;
    for (const criterio of AVALIACAO_CRITERIOS) {
      parsed[criterio.key] = parseNota(
        input.notas[criterio.key],
        criterio.maximo,
        criterio.label,
      );
    }
    notas = parsed;
  } catch (error) {
    return {
      ok: false as const,
      status: 400,
      error: error instanceof Error ? error.message : "Notas inválidas.",
    };
  }

  const stand = await prisma.stand.findUnique({
    where: { id: BigInt(input.standId) },
    include: {
      projeto: true,
      _count: { select: { avaliacoes: true } },
    },
  });
  if (!stand || !stand.projeto) {
    return {
      ok: false as const,
      status: 404,
      error: "Stand ou projeto não encontrado.",
    };
  }
  if (stand.status === "INATIVO") {
    return {
      ok: false as const,
      status: 400,
      error: "Este stand não está disponível para avaliação.",
    };
  }
  if (toId(stand.projeto.id) !== input.projetoId) {
    return {
      ok: false as const,
      status: 400,
      error: "O projeto informado não corresponde ao stand.",
    };
  }
  if (stand.projeto.status !== "APROVADO") {
    return {
      ok: false as const,
      status: 400,
      error: "Somente projetos aprovados podem ser avaliados.",
    };
  }

  const maxAvaliacoes = getMaxAvaliacoesPorStand();
  if (stand._count.avaliacoes >= maxAvaliacoes) {
    return {
      ok: false as const,
      status: 409,
      error: `Este stand já atingiu o limite de ${maxAvaliacoes} avaliações.`,
    };
  }

  const reserva = await getReservaAtivaDoStand(input.standId);
  if (
    reserva &&
    reserva.avaliadorUsuarioId !== input.avaliadorUsuarioId
  ) {
    return {
      ok: false as const,
      status: 409,
      error: "Este stand está reservado para outro avaliador.",
    };
  }

  const existente = await prisma.avaliacao.findUnique({
    where: {
      avaliadorUsuarioId_standId: {
        avaliadorUsuarioId: BigInt(input.avaliadorUsuarioId),
        standId: BigInt(input.standId),
      },
    },
  });
  if (existente) {
    return {
      ok: false as const,
      status: 409,
      error: JA_AVALIADO_MSG,
    };
  }

  const total = calcularTotal(notas);
  const observacoes = input.observacoes?.trim().slice(0, 4000) || null;

  try {
    const saved = await prisma.$transaction(async (tx) => {
      const created = await tx.avaliacao.create({
        data: {
          standId: BigInt(input.standId),
          projetoId: BigInt(input.projetoId),
          avaliadorUsuarioId: BigInt(input.avaliadorUsuarioId),
          tentativa: 1,
          ...notas,
          total,
          observacoes,
        },
      });
      await tx.avaliadorStandSorteio.deleteMany({
        where: { standId: BigInt(input.standId) },
      });
      return created;
    });

    return {
      ok: true as const,
      avaliacao: {
        id: toId(saved.id),
        tentativa: saved.tentativa,
        total: saved.total,
        status: "CONCLUIDA" as const,
        createdAt: saved.createdAt.toISOString(),
        updatedAt: saved.updatedAt.toISOString(),
      },
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false as const,
        status: 409,
        error: JA_AVALIADO_MSG,
      };
    }
    throw error;
  }
}

export { JA_AVALIADO_MSG };
