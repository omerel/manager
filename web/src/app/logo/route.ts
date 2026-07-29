import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getLogoPath } from "@/lib/branding";
import { resolveUpload } from "@/lib/storage";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
};

/** Serve the configured custom logo. Public — it also appears on the login page. */
export async function GET() {
  const logoPath = await getLogoPath();
  if (!logoPath) return new NextResponse("not found", { status: 404 });
  const abs = resolveUpload(logoPath);
  if (!abs) return new NextResponse("not found", { status: 404 });
  const buf = await readFile(abs);
  const mime = MIME[path.extname(abs).toLowerCase()] ?? "image/png";
  return new NextResponse(new Uint8Array(buf), {
    headers: { "Content-Type": mime, "Cache-Control": "public, max-age=300" },
  });
}
