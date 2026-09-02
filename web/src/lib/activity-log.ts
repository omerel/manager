import { prisma } from "@/lib/prisma";
import { getSessionUserOrNull } from "@/lib/session";
import { requireAdmin } from "@/lib/authz";

/**
 * A light trail of what users did, for the Admin to investigate with.
 *
 * WHAT IS RECORDED: acts that change the registry or who may reach it —
 * creating, editing and deleting people, plans and their items, assignments,
 * frameworks, users and grants, evaluations and rules, and importing a bundle.
 *
 * WHAT IS NOT, and why these are decisions rather than gaps:
 *   - reads — an investigation asks who *changed* something
 *   - login / logout — noise at the volume they occur
 *   - chat questions and rule runs — already recorded, in `AgentRun`
 *   - per-field resolution of an extraction proposal — the approval that
 *     matters is the person/plan write it produces, which is recorded
 *
 * This is an operational trail for a trusted Admin, NOT a tamper-proof audit
 * log: entries are ordinary rows and an Admin can delete them like any data.
 * It also stores no before/after values — recovering content is what backups
 * are for, and keeping old values here would make this a second database.
 */

/** Entries older than this are removed. 0 keeps everything. */
function retentionDays(): number {
  const raw = Number(process.env.ACTIVITY_LOG_DAYS ?? 30);
  return Number.isFinite(raw) && raw >= 0 ? Math.trunc(raw) : 30;
}

/**
 * How often a write also prunes. Pruning on every insert would put a range
 * delete in the path of every edit for no benefit; the retention window is a
 * bound on what is kept, not a promise that a row vanishes the instant it
 * lapses. Sampling keeps it self-maintaining with no scheduler.
 */
const PRUNE_EVERY = 20;
let sinceLastPrune = 0;

export async function logActivity(entry: {
  action: string;
  description: string;
  subjectType?: string;
  subjectId?: string | null;
}): Promise<void> {
  try {
    // The actor is resolved here, never passed in: no caller can attribute an
    // act to someone else, by mistake or otherwise.
    const me = await getSessionUserOrNull();
    if (!me) return; // nothing to attribute — an unauthenticated path writes nothing

    await prisma.activityLog.create({
      data: {
        actorId: me.id,
        actorName: me.name,
        action: entry.action,
        description: entry.description,
        subjectType: entry.subjectType ?? null,
        subjectId: entry.subjectId ?? null,
      },
    });

    if (++sinceLastPrune >= PRUNE_EVERY) {
      sinceLastPrune = 0;
      await prune();
    }
  } catch {
    // Deliberately swallowed. The user's edit is the product; this is an
    // observation of it. An action that succeeded must never be reported as
    // failed because the trail could not be written.
  }
}

/**
 * Record a sign-in — the ONE place an actor is supplied rather than resolved.
 *
 * `logActivity` reads the actor from the session on purpose, and writes nothing
 * when there is none. During a sign-in there is none yet: the cookie is being
 * set in this very request. Calling it there would silently record nothing and
 * look like it had worked.
 *
 * So this door exists, and it is deliberately narrow: it takes the user the
 * caller has JUST authenticated, it is called from exactly one place, and it
 * cannot be used to attribute anything else to anyone. Everywhere else the rule
 * stands — no caller names the actor.
 */
export async function logLogin(user: { id: string; name: string }): Promise<void> {
  try {
    await prisma.$transaction([
      prisma.activityLog.create({
        data: {
          actorId: user.id,
          actorName: user.name,
          action: "auth.login",
          description: "התחבר למערכת",
          subjectType: "user",
          subjectId: user.id,
        },
      }),
      // the pruning-proof half: dormancy is judged from this, not from the log
      prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
    ]);
  } catch {
    // as with logActivity: observing a sign-in must never prevent one
  }
}

async function prune(): Promise<void> {
  const days = retentionDays();
  if (days === 0) return;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  await prisma.activityLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
}

/** For tests and for an operator who wants the sweep now rather than on the next write. */
export async function pruneActivityLog(): Promise<void> {
  await prune();
}

export type ActivityRow = {
  id: string;
  actorName: string;
  action: string;
  description: string;
  createdAt: Date;
};

/**
 * Read the log. Calls requireAdmin itself: a page is presentation, and a data
 * function is what is actually reachable.
 */
export async function readActivity(opts: { actor?: string; action?: string; take?: number } = {}) {
  await requireAdmin();
  const rows = await prisma.activityLog.findMany({
    where: {
      ...(opts.actor ? { actorId: opts.actor } : {}),
      ...(opts.action ? { action: opts.action } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(opts.take ?? 200, 500),
  });
  return rows;
}

/** The actors and action kinds actually present, so a filter can never return nothing. */
export async function activityFacets() {
  await requireAdmin();
  const [actors, actions] = await Promise.all([
    prisma.activityLog.groupBy({ by: ["actorId", "actorName"], _count: true }),
    prisma.activityLog.groupBy({ by: ["action"], _count: true }),
  ]);
  return {
    actors: actors
      .map((a) => ({ id: a.actorId, name: a.actorName, count: a._count }))
      .sort((a, b) => a.name.localeCompare(b.name, "he")),
    actions: actions.map((a) => ({ action: a.action, count: a._count })).sort((a, b) => a.action.localeCompare(b.action)),
  };
}
