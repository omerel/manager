import { mkdir, writeFile, unlink, rm } from "fs/promises";
import { createReadStream, existsSync } from "fs";
import path from "path";
import { randomBytes } from "crypto";

// File storage root. MUST be backed by persistent storage in production
// (an anonymous container volume does not survive pod replacement) — see
// UPLOADS_DIR in the deployment docs.
export const UPLOADS_ROOT = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(process.cwd(), "uploads");

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

export { versionOf } from "@/lib/upload-version";

/**
 * Remove a stored file when it is replaced. Best-effort: the database is the
 * source of truth, and a file left behind is harmless — failing the upload
 * because a stale file could not be unlinked would not be.
 */
export async function deleteUpload(storagePath: string | null | undefined): Promise<void> {
  if (!storagePath) return;
  const abs = resolveUpload(storagePath); // also enforces the uploads-root guard
  if (!abs) return;
  try {
    await unlink(abs);
  } catch {
    /* ignore — see doc comment */
  }
}

/**
 * Remove everything stored for one person — every upload of theirs lives under
 * `uploads/<personId>/` (see saveUpload). Called after their deletion has
 * committed, and best-effort for the same reason deleteUpload is: the database
 * is the source of truth, and files no row points at are unreachable through
 * the app, whereas failing a committed deletion over a filesystem error would
 * leave the caller believing the person is still there.
 */
export async function deleteUploadDir(personId: string): Promise<void> {
  if (!personId) return;
  const root = path.resolve(UPLOADS_ROOT);
  const abs = path.resolve(root, personId);
  // the same traversal guard resolveUpload applies, plus a refusal to take the
  // root itself: a caller with an empty-ish id must not wipe every upload
  if (!abs.startsWith(root + path.sep)) return;
  try {
    await rm(abs, { recursive: true, force: true });
  } catch {
    /* ignore — see doc comment */
  }
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
