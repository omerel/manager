import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

/**
 * Dev-only active-user switch (stands in for real auth, task 0.2).
 * A plain GET navigation so it works over any origin/proxy (e.g. Tailscale),
 * unlike a Server Action which is origin-checked.
 */
export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid") ?? "";
  const res = NextResponse.redirect(new URL("/", req.nextUrl.origin));
  res.cookies.set(SESSION_COOKIE, uid, { httpOnly: true, sameSite: "lax", path: "/" });
  return res;
}
