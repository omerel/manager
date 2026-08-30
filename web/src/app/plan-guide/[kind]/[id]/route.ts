import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { getSessionUserOrNull } from "@/lib/session";
import { resolveUpload } from "@/lib/storage";

/**
 * Serve a plan item's «פורמטים והנחיות» file.
 *
 * Any signed-in user may take it: a guideline is reference material, and the
 * plans page it belongs to is already open to everyone signed in — gating the
 * document more tightly than the plan describing it would be theatre. Personal
 * data is not involved; the file says how an event is done, not by whom.
 *
 * The id may be a TEMPLATE item's or a person's COPY of one: a copy resolves
 * through its source, which is what makes replacing the file reach people who
 * were assigned long ago.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ kind: string; id: string }> }) {
  const user = await getSessionUserOrNull();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const { kind, id } = await ctx.params;
  if (kind !== "point" && kind !== "recurring") return new NextResponse("not found", { status: 404 });

  const select = { guideName: true, guidePath: true, guideMime: true, guideSize: true, sourceEventId: true } as const;
  const row =
    kind === "point"
      ? await prisma.pointEvent.findUnique({ where: { id }, select })
      : await prisma.recurringEvent.findUnique({ where: { id }, select });
  if (!row) return new NextResponse("not found", { status: 404 });

  // a copy carries no file of its own; it borrows its template item's, live
  const guide =
    row.guidePath
      ? row
      : row.sourceEventId
        ? kind === "point"
          ? await prisma.pointEvent.findUnique({ where: { id: row.sourceEventId }, select })
          : await prisma.recurringEvent.findUnique({ where: { id: row.sourceEventId }, select })
        : null;
  if (!guide?.guidePath) return new NextResponse("not found", { status: 404 });

  const abs = resolveUpload(guide.guidePath);
  if (!abs) return new NextResponse("file missing", { status: 404 });
  const buf = await readFile(abs);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": guide.guideMime ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(guide.guideName ?? "guide")}`,
      "Content-Length": String(buf.length),
    },
  });
}
