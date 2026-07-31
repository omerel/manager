import { NextResponse, type NextRequest } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getLogoPath } from "@/lib/branding";
import { resolveUpload } from "@/lib/storage";
import { versionOf } from "@/lib/upload-version";

// Public, but only when the URL names a specific image: a shared cache holding
// a stable /logo would keep serving the old mark to everyone after a replacement.
const IMMUTABLE = "public, max-age=31536000, immutable";
const REVALIDATE = "public, no-cache";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
};

/** Serve the configured custom logo. Public — it also appears on the login page. */
export async function GET(req: NextRequest) {
  const logoPath = await getLogoPath();
  if (!logoPath) return new NextResponse("not found", { status: 404 });
  const abs = resolveUpload(logoPath);
  if (!abs) return new NextResponse("not found", { status: 404 });

  const version = versionOf(logoPath);
  const etag = `"${version}"`;
  const versioned = !!version && req.nextUrl.searchParams.get("v") === version;

  if (!versioned && req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag, "Cache-Control": REVALIDATE } });
  }

  const buf = await readFile(abs);
  const mime = MIME[path.extname(abs).toLowerCase()] ?? "image/png";
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": mime,
      "Cache-Control": versioned ? IMMUTABLE : REVALIDATE,
      ETag: etag,
    },
  });
}
