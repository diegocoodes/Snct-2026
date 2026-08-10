import { Prisma } from "@prisma/client";

import { todayInEventTimezone } from "@/lib/checkins";
import { prisma } from "@/lib/prisma";

export const TITULACAO_CATEGORIAS = [
  {
    codigo: "PEQUENAS_CIENTISTAS",
    titulo: "Pequeno(a) Cientista",
    faixaEtaria: "6 a 12 anos",
    referenciaEscolar: "Anos iniciais (ensino fundamental)",
    enfase:
      "Curiosidade, observação, participação e explicação simples",
    idadeMin: 6,
    idadeMax: 12,
  },
  {
    codigo: "EXPLORADORAS",
    titulo: "Explorador(a)",
    faixaEtaria: "13 a 16 anos",
    referenciaEscolar:
      "Transição entre anos iniciais e finais (ensino médio)",
    enfase: "Pergunta investigável, registro, colaboração e comunicação",
    idadeMin: 13,
    idadeMax: 16,
  },
  {
    codigo: "PESQUISADORAS",
    titulo: "Pesquisador(a)",
    faixaEtaria: "17 anos ou mais",
    referenciaEscolar: "Escolas particulares / ensino médio e além",
    enfase: "Método, análise de evidências, autoria e impacto",
    idadeMin: 17,
    idadeMax: 120,
  },
] as const;

export type TitulacaoCategoriaCodigo =
  (typeof TITULACAO_CATEGORIAS)[number]["codigo"];

function toId(value: number | bigint | string) {
  return String(value);
}

function isTitulacaoCategoria(value: string): value is TitulacaoCategoriaCodigo {
  return TITULACAO_CATEGORIAS.some((item) => item.codigo === value);
}

function categoriaMeta(codigo: TitulacaoCategoriaCodigo) {
  return TITULACAO_CATEGORIAS.find((item) => item.codigo === codigo)!;
}

/** Prisma/MySQL DATE: meia-noite UTC para a unique e as buscas baterem. */
function toDataEventoDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`);
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

export function listTitulacaoCategorias() {
  return TITULACAO_CATEGORIAS.map((item) => ({
    codigo: item.codigo,
    titulo: item.titulo,
    faixaEtaria: item.faixaEtaria,
    referenciaEscolar: item.referenciaEscolar,
    enfase: item.enfase,
    idadeMin: item.idadeMin,
    idadeMax: item.idadeMax,
  }));
}

export async function getTitulacoesDoDia(avaliadorUsuarioId: string) {
  const dataEvento = todayInEventTimezone();
  const dataEventoDate = toDataEventoDate(dataEvento);
  const rows = await prisma.avaliadorTitulacao.findMany({
    where: {
      avaliadorUsuarioId: BigInt(avaliadorUsuarioId),
      dataEvento: dataEventoDate,
    },
    include: {
      aluno: { select: { id: true, nomeCompleto: true } },
      stand: { select: { id: true, codigo: true } },
      projeto: { select: { id: true, titulo: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const usadas = new Map(
    rows.map((row) => [
      row.categoria as TitulacaoCategoriaCodigo,
      {
        id: toId(row.id),
        categoria: row.categoria as TitulacaoCategoriaCodigo,
        alunoId: toId(row.alunoId),
        alunoNome: row.aluno.nomeCompleto,
        standId: toId(row.standId),
        standCodigo: row.stand.codigo,
        projetoTitulo: row.projeto.titulo,
        createdAt: row.createdAt.toISOString(),
      },
    ]),
  );

  const opcoes = TITULACAO_CATEGORIAS.map((item) => {
    const usada = usadas.get(item.codigo) ?? null;
    return {
      codigo: item.codigo,
      titulo: item.titulo,
      faixaEtaria: item.faixaEtaria,
      referenciaEscolar: item.referenciaEscolar,
      enfase: item.enfase,
      idadeMin: item.idadeMin,
      idadeMax: item.idadeMax,
      disponivel: !usada,
      concedida: usada,
    };
  });

  const disponiveis = opcoes.filter((item) => item.disponivel).length;

  return {
    dataEvento,
    totalPorDia: TITULACAO_CATEGORIAS.length,
    disponiveis,
    usadas: TITULACAO_CATEGORIAS.length - disponiveis,
    categorias: listTitulacaoCategorias(),
    opcoes,
  };
}

export async function concederTitulacao(input: {
  avaliadorUsuarioId: string;
  alunoId: string;
  standId: string;
  projetoId: string;
  categoria: string;
}) {
  if (!isTitulacaoCategoria(input.categoria)) {
    return {
      ok: false as const,
      status: 400,
      error: "Categoria de titulação inválida.",
    };
  }

  const meta = categoriaMeta(input.categoria);
  const dataEvento = todayInEventTimezone();
  const dataEventoDate = toDataEventoDate(dataEvento);

  const jaUsou = await prisma.avaliadorTitulacao.findUnique({
    where: {
      avaliadorUsuarioId_categoria_dataEvento: {
        avaliadorUsuarioId: BigInt(input.avaliadorUsuarioId),
        categoria: input.categoria,
        dataEvento: dataEventoDate,
      },
    },
  });
  if (jaUsou) {
    return {
      ok: false as const,
      status: 409,
      error: `Você já concedeu o título "${meta.titulo}" hoje. Só poderá usá-lo novamente no próximo dia do evento.`,
    };
  }

  const aluno = await prisma.professorTemaAluno.findUnique({
    where: { id: BigInt(input.alunoId) },
    include: {
      projeto: {
        include: {
          stand: true,
        },
      },
      usuario: {
        select: { id: true, dataNascimento: true, nomeCompleto: true },
      },
    },
  });

  if (!aluno) {
    return {
      ok: false as const,
      status: 404,
      error: "Aluno não encontrado.",
    };
  }

  if (toId(aluno.projetoId) !== input.projetoId) {
    return {
      ok: false as const,
      status: 400,
      error: "O aluno não pertence a este projeto.",
    };
  }

  if (!aluno.projeto.stand || toId(aluno.projeto.stand.id) !== input.standId) {
    return {
      ok: false as const,
      status: 400,
      error: "O aluno não pertence a este stand.",
    };
  }

  if (aluno.projeto.status !== "APROVADO") {
    return {
      ok: false as const,
      status: 400,
      error: "Somente alunos de projetos aprovados podem receber titulação.",
    };
  }

  const idade = ageFromBirth(aluno.usuario.dataNascimento);
  if (idade < meta.idadeMin || idade > meta.idadeMax) {
    return {
      ok: false as const,
      status: 400,
      error: `O título "${meta.titulo}" é para a faixa ${meta.faixaEtaria}. Este aluno tem ${idade} anos.`,
    };
  }

  try {
    const created = await prisma.avaliadorTitulacao.create({
      data: {
        avaliadorUsuarioId: BigInt(input.avaliadorUsuarioId),
        alunoId: aluno.id,
        alunoUsuarioId: aluno.usuarioId,
        projetoId: aluno.projetoId,
        standId: aluno.projeto.stand.id,
        categoria: input.categoria,
        dataEvento: dataEventoDate,
      },
    });

    return {
      ok: true as const,
      titulacao: {
        id: toId(created.id),
        categoria: input.categoria,
        titulo: meta.titulo,
        alunoId: toId(aluno.id),
        alunoNome: aluno.nomeCompleto || aluno.usuario.nomeCompleto,
        standCodigo: aluno.projeto.stand.codigo,
        dataEvento,
        createdAt: created.createdAt.toISOString(),
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
        error: `Você já concedeu o título "${meta.titulo}" hoje. Só poderá usá-lo novamente no próximo dia do evento.`,
      };
    }
    throw error;
  }
}
