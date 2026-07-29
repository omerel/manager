import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { computeVisibility } from "@/lib/access";
import { resolveUpload } from "@/lib/storage";
import { readFile } from "fs/promises";

/** Serve an attachment, only if the requester may see its person. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const att = await prisma.attachment.findUnique({
    where: { id },
    include: { entry: { include: { person: { select: { teamId: true } } } } },
  });
  if (!att) return new NextResponse("not found", { status: 404 });

  const user = await getSessionUser();
  const visibility = await computeVisibility(user);
  const teamId = att.entry.person.teamId;
  const allowed = teamId ? visibility.nodeIds.has(teamId) : visibility.isAdmin;
  if (!allowed) return new NextResponse("not found", { status: 404 });

  const abs = resolveUpload(att.storagePath);
  if (!abs) return new NextResponse("file missing", { status: 404 });

  const buf = await readFile(abs);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": att.mimeType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(att.filename)}`,
      "Content-Length": String(att.size),
    },
  });
}
