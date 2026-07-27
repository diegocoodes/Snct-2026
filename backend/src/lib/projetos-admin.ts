import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type ProjetoStatus = "PENDENTE" | "APROVADO" | "REJEITADO";

export type ProjetoAdmin = {
  id: string;
  titulo: string;
  area: string | null;
  descricao: string | null;
  status: ProjetoStatus;
  escolaId: string;
  escolaNome: string;
  professorUsuarioId: string;
  professorNome: string;
  professorEmail: string;
  alunos: { id: string; nomeCompleto: string }[];
  alunosCount: number;
  estande: {
    id: string;
    codigo: string;
    nome: string | null;
    localizacao: string;
  } | null;
  createdAt: string;
};

function toId(value: number | bigint | string) {
  return String(value);
}

export async function listProjetosAdmin(statusFilter?: ProjetoStatus) {
  const rows = await prisma.projeto.findMany({
    where: statusFilter ? { status: statusFilter } : undefined,
    include: {
      escola: {
        include: {
          professor: {
            select: { id: true, nomeCompleto: true, email: true },
          },
        },
      },
      stand: true,
      alunos: {
        select: { id: true, nomeCompleto: true },
        orderBy: { nomeCompleto: "asc" },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  const statusOrder: Record<ProjetoStatus, number> = {
    PENDENTE: 0,
    APROVADO: 1,
    REJEITADO: 2,
  };

  return rows
    .map(
      (row) =>
        ({
          id: toId(row.id),
          titulo: row.titulo,
          area: row.area,
          descricao: row.descricao,
          status: row.status as ProjetoStatus,
          escolaId: toId(row.escolaId),
          escolaNome: row.escola.nome,
          professorUsuarioId: toId(row.escola.professorUsuarioId),
          professorNome: row.escola.professor.nomeCompleto,
          professorEmail: row.escola.professor.email,
          alunos: row.alunos.map((aluno) => ({
            id: toId(aluno.id),
            nomeCompleto: aluno.nomeCompleto,
          })),
          alunosCount: row.alunos.length,
          estande: row.stand
            ? {
                id: toId(row.stand.id),
                codigo: row.stand.codigo,
                nome: row.stand.nome,
                localizacao: row.stand.localizacao ?? "",
              }
            : null,
          createdAt: row.createdAt.toISOString(),
        }) satisfies ProjetoAdmin,
    )
    .sort(
      (a, b) =>
        statusOrder[a.status] - statusOrder[b.status] ||
        b.createdAt.localeCompare(a.createdAt),
    );
}

export async function aprovarProjeto(projetoId: string, estandeId: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      const projeto = await tx.projeto.findUnique({
        where: { id: BigInt(projetoId) },
      });
      if (!projeto) {
        return {
          ok: false as const,
          status: 404,
          error: "Projeto não encontrado.",
        };
      }
      if (projeto.status === "APROVADO" && projeto.standId != null) {
        return {
          ok: false as const,
          status: 400,
          error: "Este projeto já está aprovado e possui stand.",
        };
      }

      const stand = await tx.stand.findUnique({
        where: { id: BigInt(estandeId) },
      });
      if (!stand) {
        return {
          ok: false as const,
          status: 404,
          error: "Stand não encontrado.",
        };
      }
      if (stand.status !== "DISPONIVEL") {
        return {
          ok: false as const,
          status: 400,
          error: "Selecione um stand com status Disponível.",
        };
      }

      if (projeto.standId != null && toId(projeto.standId) !== estandeId) {
        await tx.stand.update({
          where: { id: projeto.standId },
          data: { status: "DISPONIVEL", nome: null },
        });
      }

      await tx.projeto.update({
        where: { id: projeto.id },
        data: {
          status: "APROVADO",
          standId: BigInt(estandeId),
        },
      });
      await tx.stand.update({
        where: { id: BigInt(estandeId) },
        data: {
          status: "OCUPADO",
          nome: projeto.titulo.slice(0, 180),
        },
      });

      return {
        ok: true as const,
        projetoId: toId(projeto.id),
        titulo: projeto.titulo,
        estandeId,
      };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false as const,
        status: 409,
        error: "Este stand já está vinculado a outro projeto.",
      };
    }
    throw error;
  }
}

export async function rejeitarProjeto(projetoId: string) {
  return prisma.$transaction(async (tx) => {
    const projeto = await tx.projeto.findUnique({
      where: { id: BigInt(projetoId) },
    });
    if (!projeto) {
      return {
        ok: false as const,
        status: 404,
        error: "Projeto não encontrado.",
      };
    }

    const previousEstandeId = projeto.standId;
    await tx.projeto.update({
      where: { id: projeto.id },
      data: { status: "REJEITADO", standId: null },
    });
    if (previousEstandeId != null) {
      await tx.stand.update({
        where: { id: previousEstandeId },
        data: { status: "DISPONIVEL", nome: null },
      });
    }

    return {
      ok: true as const,
      projetoId: toId(projeto.id),
      titulo: projeto.titulo,
      previousEstandeId:
        previousEstandeId != null ? toId(previousEstandeId) : null,
    };
  });
}

export async function cancelarAprovacaoProjeto(projetoId: string) {
  return prisma.$transaction(async (tx) => {
    const projeto = await tx.projeto.findUnique({
      where: { id: BigInt(projetoId) },
    });
    if (!projeto) {
      return {
        ok: false as const,
        status: 404,
        error: "Projeto não encontrado.",
      };
    }
    if (projeto.status !== "APROVADO") {
      return {
        ok: false as const,
        status: 400,
        error: "Somente projetos aprovados podem ter a aprovação cancelada.",
      };
    }

    const previousEstandeId = projeto.standId;
    await tx.projeto.update({
      where: { id: projeto.id },
      data: { status: "PENDENTE", standId: null },
    });
    if (previousEstandeId != null) {
      await tx.stand.update({
        where: { id: previousEstandeId },
        data: { status: "DISPONIVEL", nome: null },
      });
    }

    return {
      ok: true as const,
      projetoId: toId(projeto.id),
      titulo: projeto.titulo,
      previousEstandeId:
        previousEstandeId != null ? toId(previousEstandeId) : null,
    };
  });
}

