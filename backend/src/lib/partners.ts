import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { fileTypeFromBuffer } from "file-type";

import { assertFileIsClean } from "@/lib/clamav";

const maximumLogoSize = 2 * 1024 * 1024;

function uploadsBaseDir() {
  if (process.env.SNCT_UPLOADS_BASE) return process.env.SNCT_UPLOADS_BASE;
  if (process.env.SNCT_UPLOADS_DIR) {
    return path.dirname(process.env.SNCT_UPLOADS_DIR);
  }
  return path.join(process.cwd(), "uploads");
}

export function partnersUploadsDir() {
  return path.join(uploadsBaseDir(), "parceiros");
}

function isSvgBuffer(buffer: Buffer) {
  const head = buffer.subarray(0, 256).toString("utf8").trim().toLowerCase();
  return head.startsWith("<svg") || head.includes("<svg");
}

export async function savePartnerLogo(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength < 1 || buffer.byteLength > maximumLogoSize) {
    throw Response.json(
      { error: "Envie uma logomarca de até 2 MB." },
      { status: 400 },
    );
  }

  const detected = await fileTypeFromBuffer(buffer);
  const mime = detected?.mime ?? (isSvgBuffer(buffer) ? "image/svg+xml" : "");
  const allowed = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/svg+xml",
  ]);
  if (!allowed.has(mime)) {
    throw Response.json(
      { error: "Use uma logomarca em PNG, WebP, JPEG ou SVG." },
      { status: 400 },
    );
  }

  await assertFileIsClean(buffer);
  await mkdir(partnersUploadsDir(), { recursive: true });

  const ext =
    mime === "image/png"
      ? ".png"
      : mime === "image/webp"
        ? ".webp"
        : mime === "image/svg+xml"
          ? ".svg"
          : ".jpg";
  const storageName = `partner-${randomBytes(12).toString("hex")}${ext}`;
  await writeFile(path.join(partnersUploadsDir(), storageName), buffer);
  return `/api/uploads/parceiros/${storageName}`;
}

export function partnerLogoFilename(logoPath: string) {
  const prefix = "/api/uploads/parceiros/";
  if (!logoPath.startsWith(prefix)) return null;
  const filename = logoPath.slice(prefix.length);
  if (!/^[a-zA-Z0-9._-]+$/.test(filename) || filename.includes("..")) {
    return null;
  }
  return filename;
}

export async function deletePartnerLogoFile(logoPath: string) {
  const filename = partnerLogoFilename(logoPath);
  if (!filename) return;
  await unlink(path.join(partnersUploadsDir(), filename)).catch(() => {});
}
