import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const AVALIACAO_CRITERIOS = [
  {
    key: "c11Organizacao",
    codigo: "1.1",
    secao: "Apresentação do trabalho",
    label: "Organização (qualidade do estande e materiais)",
  },
  {
    key: "c12Estruturacao",
    codigo: "1.2",
    secao: "Apresentação do trabalho",
    label: "Estruturação (Introdução, Desenvolvimento, Conclusão)",
  },
  {
    key: "c13RelevanciaTema",
    codigo: "1.3",
    secao: "Apresentação do trabalho",
    label: "Relevância do Tema",
  },
  {
    key: "c14ImpactoProjeto",
    codigo: "1.4",
    secao: "Apresentação do trabalho",
    label: "Impacto do Projeto",
  },
  {
    key: "c21Comunicacao",
    codigo: "2.1",
    secao: "Apresentação oral",
    label: "Capacidade de Comunicação científica",
  },
  {
    key: "c22RespostaPerguntas",
    codigo: "2.2",
    secao: "Apresentação oral",
    label: "Capacidade de responder perguntas do avaliador",
  },
  {
    key: "c31Fundamentacao",
    codigo: "3.1",
    secao: "Desenvolvimento do trabalho",
    label: "Fundamentação Científica",
  },
  {
    key: "c32Metodo",
    codigo: "3.2",
    secao: "Desenvolvimento do trabalho",
    label: "Adequação do método utilizado",
  },
  {
    key: "c35Originalidade",
    codigo: "3.5",
    secao: "Desenvolvimento do trabalho",
    label: "Originalidade e Inovação",
  },
  {
    key: "c34Conclusao",
    codigo: "3.4",
    secao: "Desenvolvimento do trabalho",
    label: "Conclusão coerente e de acordo com os resultados",
  },
] as const;

export type CriterioKey = (typeof AVALIACAO_CRITERIOS)[number]["key"];

export type NotasAvaliacao = Record<CriterioKey, number | null>;

function toId(value: number | bigint | string) {
  return String(value);
}

function parseNota(value: unknown): number | null {
  if (value === null || value === undefined || value === "" || value === "N/A") {
    return null;
  }
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    throw new Error("Cada nota deve ser 1 a 5 ou N/A.");
  }
  return n;
}

export function calcularTotal(notas: NotasAvaliacao) {
  return AVALIACAO_CRITERIOS.reduce((sum, item) => {
    const nota = notas[item.key];
    return sum + (typeof nota === "number" ? nota : 0);
  }, 0);
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
            select: { id: true, nomeCompleto: true },
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
      alunos: projeto.alunos.map((aluno) => ({
        id: toId(aluno.id),
        nomeCompleto: aluno.nomeCompleto,
      })),
    },
  };
}

export async function getAvaliacaoDoAvaliador(
  avaliadorUsuarioId: string,
  projetoId: string,
) {
  const row = await prisma.avaliacao.findUnique({
    where: {
      avaliadorUsuarioId_projetoId: {
        avaliadorUsuarioId: BigInt(avaliadorUsuarioId),
        projetoId: BigInt(projetoId),
      },
    },
  });
  if (!row) return null;
  return {
    id: toId(row.id),
    standId: toId(row.standId),
    projetoId: toId(row.projetoId),
    notas: {
      c11Organizacao: row.c11Organizacao,
      c12Estruturacao: row.c12Estruturacao,
      c13RelevanciaTema: row.c13RelevanciaTema,
      c14ImpactoProjeto: row.c14ImpactoProjeto,
      c21Comunicacao: row.c21Comunicacao,
      c22RespostaPerguntas: row.c22RespostaPerguntas,
      c31Fundamentacao: row.c31Fundamentacao,
      c32Metodo: row.c32Metodo,
      c35Originalidade: row.c35Originalidade,
      c34Conclusao: row.c34Conclusao,
    } satisfies NotasAvaliacao,
    total: row.total,
    observacoes: row.observacoes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
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
    notas = {
      c11Organizacao: parseNota(input.notas.c11Organizacao),
      c12Estruturacao: parseNota(input.notas.c12Estruturacao),
      c13RelevanciaTema: parseNota(input.notas.c13RelevanciaTema),
      c14ImpactoProjeto: parseNota(input.notas.c14ImpactoProjeto),
      c21Comunicacao: parseNota(input.notas.c21Comunicacao),
      c22RespostaPerguntas: parseNota(input.notas.c22RespostaPerguntas),
      c31Fundamentacao: parseNota(input.notas.c31Fundamentacao),
      c32Metodo: parseNota(input.notas.c32Metodo),
      c35Originalidade: parseNota(input.notas.c35Originalidade),
      c34Conclusao: parseNota(input.notas.c34Conclusao),
    };
  } catch (error) {
    return {
      ok: false as const,
      status: 400,
      error: error instanceof Error ? error.message : "Notas inválidas.",
    };
  }

  const stand = await prisma.stand.findUnique({
    where: { id: BigInt(input.standId) },
    include: { projeto: true },
  });
  if (!stand || !stand.projeto) {
    return {
      ok: false as const,
      status: 404,
      error: "Stand ou projeto não encontrado.",
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

  const total = calcularTotal(notas);
  const observacoes = input.observacoes?.trim().slice(0, 4000) || null;

  try {
    const saved = await prisma.avaliacao.upsert({
      where: {
        avaliadorUsuarioId_projetoId: {
          avaliadorUsuarioId: BigInt(input.avaliadorUsuarioId),
          projetoId: BigInt(input.projetoId),
        },
      },
      create: {
        standId: BigInt(input.standId),
        projetoId: BigInt(input.projetoId),
        avaliadorUsuarioId: BigInt(input.avaliadorUsuarioId),
        ...notas,
        total,
        observacoes,
      },
      update: {
        ...notas,
        total,
        observacoes,
      },
    });

    return {
      ok: true as const,
      avaliacao: {
        id: toId(saved.id),
        total: saved.total,
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
        error: "Já existe uma avaliação deste avaliador para o projeto.",
      };
    }
    throw error;
  }
}
