import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { GUEST_COOKIE, verifyGuestToken } from "@/lib/guest-token";
import { findByIdentity } from "@/lib/identity-keys";

/**
 * The calendar day a stored date names, as `yyyy-mm-dd`.
 *
 * Dates written through `parseIsraeliDate` are already UTC midnight, so a bare
 * `getTime()` comparison would usually do. Usually is not always: a birth date
 * that arrived through the bulk import or the document extraction may carry a
 * time. Comparing the day parts means a guest is never refused because their
 * record was created by one route rather than another.
 */
function dayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

/**
 * Who may be admitted as a guest, and who the current guest is.
 *
 * Note what this module does NOT export: anything that takes a person id from
 * the caller. The only way to reach a person here is through the signed cookie,
 * so there is no function a future page could call with an id off the URL.
 */

/** The one message every failure returns. Stated once so it cannot drift apart. */
export const GUEST_REFUSAL = "לא נמצאה עבורך תכנית קריירה.";

/**
 * May this pair be admitted? The person, or null.
 *
 * ONE exit for every failure, and the reason is never returned — not to the
 * caller, not in a log, not as a thrown message. Five different failures have
 * to look identical to the visitor, and the surest way to keep them identical
 * is to leave the caller nothing to tell them apart with:
 *
 *   · no תעודת זהות field defined in the card schema
 *   · no person holds that value
 *   · more than one person holds it (never choose between them)
 *   · the person has no recorded date of birth
 *   · the date of birth does not match
 *   · the person has no career plan assigned
 *
 * That last one is why this cannot simply reuse `findByIdentity`: being found
 * is not being admitted.
 */
export async function resolveGuest(birthDate: Date | null, tz: string): Promise<{ id: string; fullName: string } | null> {
  if (!birthDate || !tz.trim()) return null;

  // findByIdentity knows both keys; guest entry accepts תעודת זהות alone, so
  // the personal number is not passed. See design.md — one door, one key.
  const hits = await findByIdentity({ tz });
  if (hits.length !== 1) return null; // nobody, or an ambiguity we refuse to resolve

  const person = await prisma.person.findUnique({
    where: { id: hits[0].personId },
    select: { id: true, fullName: true, birthDate: true, assignedPlanId: true },
  });
  if (!person?.birthDate) return null;
  if (!person.assignedPlanId) return null; // found, but nothing to show them

  // a date is a day, not an instant — the rule the rest of the system uses
  if (dayKey(person.birthDate) !== dayKey(birthDate)) return null;

  return { id: person.id, fullName: person.fullName };
}

/**
 * The guest this request belongs to, or null.
 *
 * Re-checks the plan on every read rather than trusting the cookie: the cookie
 * only says "this person was admitted once". Removing someone's plan should
 * close the door, and a stateless token cannot be revoked.
 */
export async function getGuestPersonOrNull(): Promise<{ id: string; fullName: string } | null> {
  const jar = await cookies();
  const personId = verifyGuestToken(jar.get(GUEST_COOKIE)?.value);
  if (!personId) return null;

  const person = await prisma.person.findUnique({
    where: { id: personId },
    select: { id: true, fullName: true, assignedPlanId: true },
  });
  if (!person?.assignedPlanId) return null;
  return { id: person.id, fullName: person.fullName };
}
