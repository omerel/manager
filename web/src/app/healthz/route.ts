import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Liveness/readiness probe (OpenShift): 200 when the app is up and the
 * database answers; 503 otherwise. Unauthenticated — exposes nothing.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
