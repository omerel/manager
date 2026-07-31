import { NextResponse, type NextRequest } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getSessionUserOrNull } from "@/lib/session";
import { computeVisibility } from "@/lib/access";
import { resolveUpload } from "@/lib/storage";
import { versionOf } from "@/lib/upload-version";

// A versioned URL names one specific image, so it can be cached hard; an
// unversioned one must revalidate, or a replaced photo goes stale (which is
// exactly what a fixed max-age on a stable URL used to cause).
const IMMUTABLE = "private, max-age=31536000, immutable";
const REVALIDATE = "private, no-cache";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/** Serve a person's profile photo, only to users who may see the person. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const person = await prisma.person.findUnique({ where: { id }, select: { teamId: true, photoPath: true } });
  if (!person?.photoPath) return new NextResponse("not found", { status: 404 });

  const user = await getSessionUserOrNull();
  if (!user) return new NextResponse("unauthorized", { status: 401 });
  const visibility = await computeVisibility(user);
  const allowed = person.teamId ? visibility.nodeIds.has(person.teamId) : visibility.isAdmin;
  if (!allowed) return new NextResponse("not found", { status: 404 });

  const abs = resolveUpload(person.photoPath);
  if (!abs) return new NextResponse("not found", { status: 404 });

  const version = versionOf(person.photoPath);
  const etag = `"${version}"`;
  const versioned = !!version && req.nextUrl.searchParams.get("v") === version;

  // an unversioned request may already hold the current image
  if (!versioned && req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag, "Cache-Control": REVALIDATE } });
  }

  const buf = await readFile(abs);
  const mime = MIME[path.extname(abs).toLowerCase()] ?? "application/octet-stream";
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": mime,
      "Cache-Control": versioned ? IMMUTABLE : REVALIDATE,
      ETag: etag,
    },
  });
}
