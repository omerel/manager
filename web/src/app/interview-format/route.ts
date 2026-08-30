import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { getSessionUserOrNull } from "@/lib/session";
import { getInterviewFormat } from "@/lib/branding";
import { resolveUpload } from "@/lib/storage";

/** The house format for an interview summary — one file, for every signed-in user. */
export async function GET() {
  const user = await getSessionUserOrNull();
  if (!user) return new NextResponse("unauthorized", { status: 401 });

  const fmt = await getInterviewFormat();
  if (!fmt) return new NextResponse("not found", { status: 404 });
  const abs = resolveUpload(fmt.path);
  if (!abs) return new NextResponse("file missing", { status: 404 });

  const buf = await readFile(abs);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": fmt.mime,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fmt.name)}`,
      "Content-Length": String(buf.length),
    },
  });
}
