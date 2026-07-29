import { NextResponse, type NextRequest } from "next/server";
import { getSessionUserOrNull } from "@/lib/session";
import { buildFullZip, buildConfigJson } from "@/lib/portability";

/** Admin-only export download: ?scope=full (ZIP with files) | ?scope=config (JSON). */
export async function GET(req: NextRequest) {
  const user = await getSessionUserOrNull();
  if (!user || user.role !== "ADMIN") return new NextResponse("forbidden", { status: 403 });

  const scope = req.nextUrl.searchParams.get("scope") === "config" ? "config" : "full";
  const stamp = new Date().toISOString().slice(0, 10);

  if (scope === "config") {
    const json = await buildConfigJson();
    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`תצורה-${stamp}.json`)}`,
      },
    });
  }

  const zip = await buildFullZip();
  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`גיבוי-מלא-${stamp}.zip`)}`,
    },
  });
}
