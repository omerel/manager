/**
 * Version token for a stored file, used to make image URLs change when their
 * content does. Derived from the random prefix `saveUpload` puts on every
 * filename, so it is fresh on every upload and needs no separate column.
 *
 * Client-safe on purpose: components build versioned URLs, and importing
 * `storage.ts` for this would pull `fs` into the browser bundle.
 */
export function versionOf(storagePath: string | null | undefined): string {
  if (!storagePath) return "";
  const name = storagePath.split("/").pop() ?? "";
  const prefix = name.split("-", 1)[0];
  return /^[0-9a-f]{4,32}$/.test(prefix) ? prefix : ""; // ignore paths not written by saveUpload
}

/** `/photo/<id>` or `/logo`, carrying the token when there is one. */
export function versionedUrl(base: string, storagePath: string | null | undefined): string {
  const v = versionOf(storagePath);
  return v ? `${base}?v=${v}` : base;
}
