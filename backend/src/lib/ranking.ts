import { prisma } from "@/lib/prisma";
import {
  TITULACAO_CATEGORIAS,
  type TitulacaoCategoriaCodigo,
} from "@/lib/titulacoes";

const DEFAULT_LIMIT = 10;
const TOTAL_MAXIMO = 100;

function toId(value: number | bigint | string) {
  return String(value);
}

function tituloCategoria(codigo: string) {
  return (
    TITULACAO_CATEGORIAS.find((item) => item.codigo === codigo)?.titulo ??
    codigo
  );
}

/** Trabalhos com melhor média de notas (e mais avaliações como desempate). */
export async function listRankingTrabalhos(limit = DEFAULT_LIMIT) {
  const grouped = await prisma.avaliacao.groupBy({
    by: ["standId", "projetoId"],
    _avg: { total: true },
    _count: { _all: true },
    _max: { total: true },
    orderBy: [{ _avg: { total: "desc" } }, { _count: { standId: "desc" } }],
    take: Math.max(1, Math.min(limit, 50)),
  });

  if (grouped.length === 0) return [];

  const standIds = grouped.map((row) => row.standId);
  const projetoIds = grouped.map((row) => row.projetoId);

  const [stands, projetos] = await Promise.all([
    prisma.stand.findMany({
      where: { id: { in: standIds } },
      select: { id: true, codigo: true, nome: true },
    }),
    prisma.projeto.findMany({
      where: { id: { in: projetoIds } },
      select: {
        id: true,
        titulo: true,
        area: true,
        escola: { select: { nome: true } },
      },
    }),
  ]);

  const standMap = new Map(stands.map((item) => [toId(item.id), item]));
  const projetoMap = new Map(projetos.map((item) => [toId(item.id), item]));

  return grouped.map((row, index) => {
    const stand = standMap.get(toId(row.standId));
    const projeto = projetoMap.get(toId(row.projetoId));
    const media = Number(row._avg.total ?? 0);
    return {
      posicao: index + 1,
      standId: toId(row.standId),
      standCodigo: stand?.codigo ?? "—",
      standNome: stand?.nome || stand?.codigo || "—",
      projetoId: toId(row.projetoId),
      projetoTitulo: projeto?.titulo ?? "Projeto",
      projetoArea: projeto?.area ?? null,
      escolaNome: projeto?.escola?.nome ?? null,
      media: Math.round(media * 10) / 10,
      notaMaxima: row._max.total ?? 0,
      avaliacoesCount: row._count._all,
      totalMaximo: TOTAL_MAXIMO,
    };
  });
}

/** Alunos com mais titulações (destaques) recebidas. */
export async function listRankingTitulacoes(limit = DEFAULT_LIMIT) {
  const grouped = await prisma.avaliadorTitulacao.groupBy({
    by: ["alunoId"],
    _count: { _all: true },
    orderBy: { _count: { alunoId: "desc" } },
    take: Math.max(1, Math.min(limit, 50)),
  });

  if (grouped.length === 0) return [];

  const alunoIds = grouped.map((row) => row.alunoId);
  const alunos = await prisma.professorTemaAluno.findMany({
    where: { id: { in: alunoIds } },
    select: {
      id: true,
      nomeCompleto: true,
      projeto: {
        select: {
          titulo: true,
          escola: { select: { nome: true } },
          stand: { select: { codigo: true } },
        },
      },
    },
  });

  const titulos = await prisma.avaliadorTitulacao.findMany({
    where: { alunoId: { in: alunoIds } },
    select: { alunoId: true, categoria: true },
  });

  const alunoMap = new Map(alunos.map((item) => [toId(item.id), item]));
  const categoriasPorAluno = new Map<string, Map<string, number>>();
  for (const row of titulos) {
    const key = toId(row.alunoId);
    const bag = categoriasPorAluno.get(key) ?? new Map<string, number>();
    bag.set(row.categoria, (bag.get(row.categoria) ?? 0) + 1);
    categoriasPorAluno.set(key, bag);
  }

  return grouped.map((row, index) => {
    const aluno = alunoMap.get(toId(row.alunoId));
    const bag = categoriasPorAluno.get(toId(row.alunoId));
    const categorias = [...(bag?.entries() ?? [])].map(([codigo, quantidade]) => ({
      codigo: codigo as TitulacaoCategoriaCodigo | string,
      titulo: tituloCategoria(codigo),
      quantidade,
    }));

    return {
      posicao: index + 1,
      alunoId: toId(row.alunoId),
      alunoNome: aluno?.nomeCompleto ?? "Aluno",
      projetoTitulo: aluno?.projeto.titulo ?? null,
      escolaNome: aluno?.projeto.escola?.nome ?? null,
      standCodigo: aluno?.projeto.stand?.codigo ?? null,
      titulacoesCount: row._count._all,
      categorias,
    };
  });
}

export async function getRankingAoVivo(limit = DEFAULT_LIMIT) {
  const [trabalhos, titulacoes] = await Promise.all([
    listRankingTrabalhos(limit),
    listRankingTitulacoes(limit),
  ]);
  return {
    updatedAt: new Date().toISOString(),
    trabalhos,
    titulacoes,
  };
}
