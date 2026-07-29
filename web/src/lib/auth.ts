import { createHmac, timingSafeEqual } from "crypto";

// Stateless HMAC-signed session token: "<userId>.<expiresMs>.<hmac>".
// Signed with APP_SECRET; no DB session table (see design D1).

export const SESSION_COOKIE = "session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function secret(): string {
  const s = process.env.APP_SECRET;
  if (!s) throw new Error("APP_SECRET is not configured.");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function createSessionToken(userId: string, now = Date.now()): string {
  const payload = `${userId}.${now + SESSION_TTL_MS}`;
  return `${payload}.${sign(payload)}`;
}

/** Returns the userId for a valid, unexpired token; null otherwise. */
export function verifySessionToken(token: string | undefined, now = Date.now()): string | null {
  if (!token) return null;
  const lastDot = token.lastIndexOf(".");
  if (lastDot < 0) return null;
  const payload = token.slice(0, lastDot);
  const mac = token.slice(lastDot + 1);
  const expected = sign(payload);
  const a = Buffer.from(mac, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const [userId, expiresStr] = payload.split(".");
  if (!userId || !expiresStr) return null;
  if (Number(expiresStr) < now) return null; // expired
  return userId;
}

export function devSwitchEnabled(): boolean {
  return process.env.DEV_USER_SWITCH === "1";
}
