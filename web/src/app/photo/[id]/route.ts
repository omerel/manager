import { NextResponse, type NextRequest } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { computeVisibility } from "@/lib/access";
import { resolveUpload } from "@/lib/storage";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/** Serve a person's profile photo, only to users who may see the person. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const person = await prisma.person.findUnique({ where: { id }, select: { teamId: true, photoPath: true } });
  if (!person?.photoPath) return new NextResponse("not found", { status: 404 });

  const user = await getSessionUser();
  const visibility = await computeVisibility(user);
  const allowed = person.teamId ? visibility.nodeIds.has(person.teamId) : visibility.isAdmin;
  if (!allowed) return new NextResponse("not found", { status: 404 });

  const abs = resolveUpload(person.photoPath);
  if (!abs) return new NextResponse("not found", { status: 404 });

  const buf = await readFile(abs);
  const mime = MIME[path.extname(abs).toLowerCase()] ?? "application/octet-stream";
  return new NextResponse(new Uint8Array(buf), {
    headers: { "Content-Type": mime, "Cache-Control": "private, max-age=60" },
  });
}
