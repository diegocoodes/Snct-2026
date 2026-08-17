import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import {
  assertTrustedMutation,
  enforceRateLimit,
  securityErrorResponse,
} from "@/lib/request-security";

type GameField = {
  id: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
};

export async function GET(_request: Request, slug: string) {
  const form = await prisma.gameForm.findUnique({
    where: { slug: decodeURIComponent(slug) },
  });
  if (!form || !form.active) {
    return Response.json(
      { error: "Formulário não encontrado." },
      { status: 404 },
    );
  }
  return Response.json({
    form: {
      id: form.id,
      title: form.title,
      slug: form.slug,
      description: form.description,
      fields: form.fields,
    },
  });
}

export async function POST(request: Request, slug: string) {
  try {
    assertTrustedMutation(request);
    await enforceRateLimit({
      request,
      scope: "game-form-submit",
      identifier: decodeURIComponent(slug),
      limit: 20,
      windowSeconds: 60,
    });
    const form = await prisma.gameForm.findUnique({
      where: { slug: decodeURIComponent(slug) },
    });
    if (!form || !form.active) {
      return Response.json(
        { error: "Formulário não encontrado." },
        { status: 404 },
      );
    }
    const body = (await request.json().catch(() => null)) as {
      answers?: Record<string, unknown>;
    } | null;
    const fields = Array.isArray(form.fields)
      ? (form.fields as unknown as GameField[])
      : [];
    const answers: Record<string, string | boolean> = {};
    for (const field of fields) {
      const value = body?.answers?.[field.id];
      if (
        field.required &&
        (value === undefined || value === null || value === "")
      ) {
        return Response.json(
          { error: `Preencha o campo “${field.label}”.` },
          { status: 400 },
        );
      }
      answers[field.id] =
        typeof value === "boolean" ? value : String(value ?? "").slice(0, 2000);
    }
    await prisma.gameFormSubmission.create({
      data: {
        id: `game-response-${randomUUID()}`,
        formId: form.id,
        answers,
      },
    });
    return Response.json({ ok: true });
  } catch (error) {
    return securityErrorResponse(error);
  }
}
