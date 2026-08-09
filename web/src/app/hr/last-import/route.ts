import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { getSessionUserOrNull } from "@/lib/session";
import { resolveUpload } from "@/lib/storage";

/**
 * The last concluded update file, as uploaded — so an HR user can open it and
 * see exactly what format the master system produced last time.
 */
export async function GET() {
  const user = await getSessionUserOrNull();
  if (!user || (user.role !== "HR" && user.role !== "ADMIN")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const snap = await prisma.importSnapshot.findFirst({ orderBy: { uploadedAt: "desc" } });
  if (!snap) return NextResponse.json({ error: "אין עדיין קובץ בהיסטוריה" }, { status: 404 });
  const abs = resolveUpload(snap.filePath);
  if (!abs) return NextResponse.json({ error: "הקובץ אינו זמין עוד בדיסק" }, { status: 404 });
  try {
    const bytes = await readFile(abs);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(snap.filename)}`,
      },
    });
  } catch {
    return NextResponse.json({ error: "הקובץ אינו זמין עוד בדיסק" }, { status: 404 });
  }
}
