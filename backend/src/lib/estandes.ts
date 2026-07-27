import { randomBytes } from "node:crypto";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type EstandeStatus = "DISPONIVEL" | "OCUPADO" | "INATIVO";

export type Estande = {
  id: string;
  codigo: string;
  nome: string | null;
  localizacao: string | null;
  status: EstandeStatus;
  qrCodeHash: string;
  createdAt: string;
  updatedAt: string;
  projetoId?: string | null;
  projetoTitulo?: string | null;
};

function toId(value: number | bigint | string) {
  return String(value);
}

export function createStandQrHash() {
  return `st_${randomBytes(24).toString("hex")}`;
}

function mapStand(row: {
  id: bigint;
  codigo: string;
  nome: string | null;
  localizacao: string | null;
  status: string;
  qrCodeHash: string;
  createdAt: Date;
  updatedAt: Date;
  projeto: { id: bigint; titulo: string } | null;
}): Estande {
  return {
    id: toId(row.id),
    codigo: row.codigo,
    nome: row.nome,
    localizacao: row.localizacao,
    status: row.status as EstandeStatus,
    qrCodeHash: row.qrCodeHash,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    projetoId: row.projeto ? toId(row.projeto.id) : null,
    projetoTitulo: row.projeto?.titulo ?? null,
  };
}

export async function listEstandes(options?: {
  status?: EstandeStatus;
  onlyDisponiveis?: boolean;
}) {
  const status =
    options?.onlyDisponiveis || options?.status === "DISPONIVEL"
      ? "DISPONIVEL"
      : options?.status;

  const rows = await prisma.stand.findMany({
    where: status ? { status } : undefined,
    include: { projeto: { select: { id: true, titulo: true } } },
    orderBy: [{ codigo: "asc" }],
  });

  return rows
    .map(mapStand)
    .sort((a, b) => {
      const na = Number(a.codigo);
      const nb = Number(b.codigo);
      if (
        !Number.isNaN(na) &&
        !Number.isNaN(nb) &&
        a.codigo.trim() !== "" &&
        b.codigo.trim() !== ""
      ) {
        return na - nb;
      }
      return a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true });
    });
}

export async function createEstande(input: {
  codigo: string;
  status?: EstandeStatus;
}) {
  const codigo = input.codigo.trim().slice(0, 40);
  const status: EstandeStatus =
    input.status === "INATIVO" ? "INATIVO" : "DISPONIVEL";

  if (!codigo) {
    return { ok: false as const, status: 400, error: "Informe o número do stand." };
  }

  try {
    const created = await prisma.stand.create({
      data: {
        codigo,
        nome: null,
        localizacao: null,
        status,
        qrCodeHash: createStandQrHash(),
      },
      include: { projeto: { select: { id: true, titulo: true } } },
    });
    return { ok: true as const, estande: mapStand(created) };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false as const,
        status: 409,
        error: "Já existe um stand com este número.",
      };
    }
    return { ok: false as const, status: 500, error: "Falha ao criar o stand." };
  }
}

export async function updateEstande(
  estandeId: string,
  input: {
    codigo?: string;
    status?: EstandeStatus;
  },
) {
  const current = await prisma.stand.findUnique({
    where: { id: BigInt(estandeId) },
    include: { projeto: { select: { id: true } } },
  });
  if (!current) {
    return { ok: false as const, status: 404, error: "Stand não encontrado." };
  }

  const codigo = (input.codigo ?? current.codigo).trim().slice(0, 40);
  let status = input.status ?? (current.status as EstandeStatus);

  if (!codigo) {
    return {
      ok: false as const,
      status: 400,
      error: "Informe o número do stand.",
    };
  }

  if (current.projeto && status === "DISPONIVEL") {
    return {
      ok: false as const,
      status: 400,
      error:
        "Este stand está vinculado a um projeto. Cancele a aprovação ou reprove o projeto para liberá-lo.",
    };
  }
  if (current.projeto && status === "INATIVO") {
    return {
      ok: false as const,
      status: 400,
      error: "Não é possível inativar um stand ocupado por um projeto.",
    };
  }
  if (!current.projeto && status === "OCUPADO") {
    return {
      ok: false as const,
      status: 400,
      error: "Marque o stand como Ocupado apenas pela aprovação de um projeto.",
    };
  }
  if (current.projeto) {
    status = "OCUPADO";
  }

  if (codigo.toLowerCase() !== current.codigo.toLowerCase()) {
    const others = await prisma.stand.findMany({
      where: { id: { not: current.id } },
      select: { codigo: true },
    });
    if (others.some((item) => item.codigo.toLowerCase() === codigo.toLowerCase())) {
      return {
        ok: false as const,
        status: 409,
        error: "Já existe um stand com este número.",
      };
    }
  }

  try {
    const updated = await prisma.stand.update({
      where: { id: current.id },
      data: { codigo, status },
      include: { projeto: { select: { id: true, titulo: true } } },
    });
    return { ok: true as const, estande: mapStand(updated) };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false as const,
        status: 409,
        error: "Já existe um stand com este número.",
      };
    }
    throw error;
  }
}

export async function deleteEstande(estandeId: string) {
  const current = await prisma.stand.findUnique({
    where: { id: BigInt(estandeId) },
    include: { projeto: { select: { id: true } } },
  });
  if (!current) {
    return { ok: false as const, status: 404, error: "Stand não encontrado." };
  }
  if (current.projeto) {
    return {
      ok: false as const,
      status: 400,
      error: "Não é possível excluir um stand vinculado a um projeto.",
    };
  }

  await prisma.stand.delete({ where: { id: current.id } });
  return { ok: true as const };
}
