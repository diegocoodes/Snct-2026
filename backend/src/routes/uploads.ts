import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { partnersUploadsDir } from "@/lib/partners";

const fotosRoot =
  process.env.SNCT_UPLOADS_DIR ??
  path.join(process.cwd(), "uploads", "fotos");

function contentTypeFor(ext: string) {
  switch (ext) {
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    default:
      return "image/jpeg";
  }
}

async function serveUpload(root: string, filename: string) {
  if (!/^[a-zA-Z0-9._-]+$/.test(filename) || filename.includes("..")) {
    return Response.json({ error: "Arquivo inválido." }, { status: 400 });
  }

  const filePath = path.join(root, filename);
  try {
    await access(filePath);
  } catch {
    return Response.json({ error: "Arquivo não encontrado." }, { status: 404 });
  }

  const stream = createReadStream(filePath);
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": contentTypeFor(path.extname(filename).toLowerCase()),
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET_FOTO(_request: Request, filename: string) {
  return serveUpload(fotosRoot, filename);
}

export async function GET_PARCEIRO(_request: Request, filename: string) {
  return serveUpload(partnersUploadsDir(), filename);
}
