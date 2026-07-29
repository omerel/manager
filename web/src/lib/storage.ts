import { mkdir, writeFile } from "fs/promises";
import { createReadStream, existsSync } from "fs";
import path from "path";
import { randomBytes } from "crypto";

// Local-disk file storage for attachments (dev default; swappable later).
const UPLOADS_ROOT = path.join(process.cwd(), "uploads");

/** Persist an uploaded file; returns its relative storage path. */
export async function saveUpload(personId: string, file: File): Promise<{ storagePath: string; size: number }> {
  const safeName = file.name.replace(/[^\w.\-֐-׿]/g, "_"); // keep Hebrew, letters, dots
  const rel = path.join(personId, `${randomBytes(8).toString("hex")}-${safeName}`);
  const abs = path.join(UPLOADS_ROOT, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(abs, buf);
  return { storagePath: rel, size: buf.length };
}

/** Absolute path for a stored file, or null if missing/outside the root. */
export function resolveUpload(storagePath: string): string | null {
  const abs = path.resolve(UPLOADS_ROOT, storagePath);
  if (!abs.startsWith(path.resolve(UPLOADS_ROOT))) return null; // path traversal guard
  return existsSync(abs) ? abs : null;
}

export function uploadReadStream(absPath: string) {
  return createReadStream(absPath);
}
