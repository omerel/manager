import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

/** Hash a password as `salt:hash` (scrypt). Real auth is deferred (task 0.2); this
 *  at least avoids storing plaintext. */
export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(plain, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(plain, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
