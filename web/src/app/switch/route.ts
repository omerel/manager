import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_TTL_MS, createSessionToken, devSwitchEnabled } from "@/lib/auth";

/**
 * Dev-only user switch for local role-testing. Inert unless DEV_USER_SWITCH=1:
 * without the flag it changes nothing and just redirects home.
 */
export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/", req.nextUrl.origin));
  if (!devSwitchEnabled()) return res; // no session change

  const uid = req.nextUrl.searchParams.get("uid") ?? "";
  if (uid) {
    res.cookies.set(SESSION_COOKIE, createSessionToken(uid), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_MS / 1000,
    });
  }
  return res;
}
