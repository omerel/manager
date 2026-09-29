import { createHmac, timingSafeEqual } from "crypto";

/**
 * The guest session: a tracked person admitted to READ their own record.
 *
 * Deliberately a second, parallel mechanism rather than a second kind of user.
 * Every page in this system gates itself with `getSessionUser()`, which reads
 * the USER cookie; a guest holds a different cookie, so every existing page
 * turns them away without a line of code being written for it. That is the
 * safety argument for the whole feature, and it only holds while the two
 * cookies stay separate.
 *
 * The payload carries its own purpose:
 *
 *     user:   <userId>.<expires>.<hmac>
 *     guest:  guest.<personId>.<expires>.<hmac>
 *
 * so a token minted for one can never verify as the other. The user verifier
 * would in fact reject a guest token by accident — it would read `personId` as
 * the expiry and get NaN — but accident is not a guarantee, so BOTH verifiers
 * check the prefix outright. See `verifySessionToken`, which now refuses a
 * payload carrying this prefix.
 */

export const GUEST_COOKIE = "guest_session";

/**
 * Twelve hours, against the user session's seven days. A guest signs in from a
 * shared terminal to look at their plan and walks away; a week-long session
 * there is a week in which anyone can read their record. This is session
 * hygiene, not protection against guessing — that was deliberately declined.
 */
export const GUEST_TTL_MS = 12 * 60 * 60 * 1000;

const PREFIX = "guest";

function secret(): string {
  const s = process.env.APP_SECRET;
  if (!s) throw new Error("APP_SECRET is not configured.");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function createGuestToken(personId: string, now = Date.now()): string {
  const payload = `${PREFIX}.${personId}.${now + GUEST_TTL_MS}`;
  return `${payload}.${sign(payload)}`;
}

/** Is this payload a guest payload? Used by BOTH verifiers, in opposite senses. */
export function isGuestPayload(payload: string): boolean {
  return payload.startsWith(`${PREFIX}.`);
}

/** Returns the personId for a valid, unexpired guest token; null otherwise. */
export function verifyGuestToken(token: string | undefined, now = Date.now()): string | null {
  if (!token) return null;
  const lastDot = token.lastIndexOf(".");
  if (lastDot < 0) return null;
  const payload = token.slice(0, lastDot);
  const mac = token.slice(lastDot + 1);

  // the purpose is checked before the signature is trusted for anything
  if (!isGuestPayload(payload)) return null;

  const expected = sign(payload);
  const a = Buffer.from(mac, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const [, personId, expiresStr] = payload.split(".");
  if (!personId || !expiresStr) return null;
  if (Number(expiresStr) < now) return null; // expired
  return personId;
}
