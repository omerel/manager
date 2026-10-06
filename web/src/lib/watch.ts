/**
 * Reading and writing watch marks. The rules themselves are in `watch-rules.ts`,
 * which carries no database import so the diagram can use them.
 */
import { prisma } from "@/lib/prisma";
import {
  WATCH_EXPIRY_DEFAULT_DAYS,
  WATCH_EXPIRY_KEY,
  isWatchLive,
  watchAgeDays,
} from "@/lib/watch-rules";
import type { WatchContext } from "@/lib/gaps";

export { WATCH_EXPIRY_DEFAULT_DAYS, WATCH_EXPIRY_KEY, watchKey, isWatchLive, watchAgeDays } from "@/lib/watch-rules";

/**
 * The configured expiry window, or a month.
 *
 * An absent row means the default — the same contract `branding.ts` uses, and
 * the reason the migration needs no backfill: nothing had to be written for the
 * default to be in force.
 */
export async function getWatchExpiryDays(): Promise<number> {
  const row = await prisma.appSetting.findUnique({ where: { key: WATCH_EXPIRY_KEY } });
  const n = Number(row?.value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : WATCH_EXPIRY_DEFAULT_DAYS;
}

/** Setting it to the default (or to nothing sensible) removes the row. */
export async function setWatchExpiryDays(days: number | null): Promise<void> {
  if (days == null || !Number.isFinite(days) || days <= 0 || Math.floor(days) === WATCH_EXPIRY_DEFAULT_DAYS) {
    await prisma.appSetting.deleteMany({ where: { key: WATCH_EXPIRY_KEY } });
    return;
  }
  const value = String(Math.floor(days));
  await prisma.appSetting.upsert({
    where: { key: WATCH_EXPIRY_KEY },
    create: { key: WATCH_EXPIRY_KEY, value },
    update: { value },
  });
}

/**
 * Every mark a person carries — EXPIRED ONES INCLUDED, and that is not an
 * oversight.
 *
 * The obvious shape was "the watches in force", and it is wrong for one case.
 * A recurring occurrence is complete when an `EvalEntry` exists for it; a watch
 * says that entry is a note, not a summary. If an expired mark vanished from
 * this map, the engine would go back to inferring completion from the entry and
 * the occurrence would turn GREEN a month after someone acknowledged it — the
 * one outcome `design.md` rules out, since a false green costs an obligation
 * nobody ever sees again.
 *
 * So expiry ends the ACKNOWLEDGEMENT, not the mark: `live: false` stops the item
 * being reported as watched, and it still refuses to let an entry stand in for a
 * completion. Only CLEARING the mark declares the interview happened.
 */
export async function watchContextFor(personId: string, today: Date): Promise<WatchContext> {
  const [marks, expiryDays] = await Promise.all([
    prisma.watchMark.findMany({ where: { personId } }),
    getWatchExpiryDays(),
  ]);
  return new Map(
    marks.map((m) => [
      m.itemKey,
      { ageDays: watchAgeDays(m.markedAt, today), live: isWatchLive(m.markedAt, expiryDays, today) },
    ]),
  );
}

/** The same question for many people at once — one query, not one per person. */
export async function watchContextForMany(
  personIds: string[],
  today: Date,
): Promise<Map<string, WatchContext>> {
  if (personIds.length === 0) return new Map();
  const [marks, expiryDays] = await Promise.all([
    prisma.watchMark.findMany({ where: { personId: { in: personIds } } }),
    getWatchExpiryDays(),
  ]);
  const out = new Map<string, Map<string, { ageDays: number; live: boolean }>>();
  for (const m of marks) {
    const ctx = out.get(m.personId) ?? new Map();
    ctx.set(m.itemKey, {
      ageDays: watchAgeDays(m.markedAt, today),
      live: isWatchLive(m.markedAt, expiryDays, today),
    });
    out.set(m.personId, ctx);
  }
  return out;
}

/** Who placed a mark and when — for the card, which names the commander who did it. */
export async function watchDetailsFor(personId: string) {
  return prisma.watchMark.findMany({
    where: { personId },
    include: { markedBy: { select: { name: true } } },
  });
}
