import type { MovementKind } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { Visibility } from "@/lib/access";
import { getSessionUserOrNull } from "@/lib/session";

/**
 * The workforce-movement record: who was created, moved, removed or departed,
 * by whom, from where to where — snapshots, no foreign keys, so a movement
 * outlives the person and the frameworks it names.
 *
 * The from/to axes are the reason this is not the activity log: they are what
 * answer "what LEFT my scope", which the current-team of a moved person can
 * only hide.
 */

export type MovementInput = {
  kind: MovementKind;
  personId: string;
  personName: string;
  fromTeamId?: string | null;
  toTeamId?: string | null;
  source: "manual" | "intake" | "import" | "org-delete" | "status";
  /** when the acting user is already known (background runs), skip the session read */
  actor?: { id: string; name: string };
  /**
   * Pre-resolved path snapshots. REQUIRED when the framework will be gone by
   * emission time — the org-delete flow captures paths before the delete,
   * because reading them afterwards would snapshot nothing.
   */
  fromPath?: string | null;
  toPath?: string | null;
};

/** The team's full path, read NOW — the snapshot the row will carry forever. */
export async function pathOf(teamId: string | null | undefined): Promise<string | null> {
  if (!teamId) return null;
  const nodes = await prisma.orgNode.findMany({ select: { id: true, name: true, parentId: true } });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const parts: string[] = [];
  let cur = byId.get(teamId);
  while (cur) {
    parts.unshift(cur.name);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return parts.length ? parts.join(" ▸ ") : null;
}

/**
 * Record one movement. Swallows its own failures — a record of the act must
 * never become the reason the act fails — and prunes old rows on a sample of
 * writes, the activity log's own discipline.
 */
export async function emitMovement(input: MovementInput): Promise<void> {
  try {
    const actor = input.actor ?? (await getSessionUserOrNull());
    if (!actor) return; // no actor, no attribution — and nothing worth failing over
    const fromPath = input.fromPath !== undefined ? input.fromPath : await pathOf(input.fromTeamId);
    const toPath = input.toPath !== undefined ? input.toPath : await pathOf(input.toTeamId);
    await prisma.personMovement.create({
      data: {
        kind: input.kind,
        personId: input.personId,
        personName: input.personName,
        fromTeamId: input.fromTeamId ?? null,
        fromPath,
        toTeamId: input.toTeamId ?? null,
        toPath,
        actorId: actor.id,
        actorName: actor.name,
        source: input.source,
      },
    });
    if (Math.random() < 0.05) await prune();
  } catch {
    /* deliberately quiet */
  }
}

/** Retention, separate from the activity log's. Generous by default: a control record. */
function retentionDays(): number {
  const raw = Number(process.env.MOVEMENT_LOG_DAYS ?? 365);
  return Number.isFinite(raw) && raw > 0 ? raw : 365;
}

async function prune(): Promise<void> {
  const cutoff = new Date(Date.now() - retentionDays() * 24 * 60 * 60 * 1000);
  await prisma.personMovement.deleteMany({ where: { at: { lt: cutoff } } });
}

export async function pruneMovements(): Promise<void> {
  await prune();
}

/**
 * One day's movements, scoped: an HR user sees a movement when its source OR
 * its destination lies inside their edit scope — so what left the scope is
 * still theirs to see. The Admin sees everything. Unassigned ends (null team)
 * ride along with whichever end IS in scope.
 */
export async function readMovements(
  visibility: Visibility,
  day: Date,
  filters: { kind?: MovementKind; teamId?: string; actorId?: string } = {},
) {
  const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const rows = await prisma.personMovement.findMany({
    where: {
      at: { gte: start, lt: end },
      ...(filters.kind ? { kind: filters.kind } : {}),
      ...(filters.actorId ? { actorId: filters.actorId } : {}),
      ...(filters.teamId ? { OR: [{ fromTeamId: filters.teamId }, { toTeamId: filters.teamId }] } : {}),
    },
    orderBy: { at: "desc" },
  });
  const inScope = (teamId: string | null) => !!teamId && visibility.canEdit(teamId);
  const scoped = visibility.isAdmin ? rows : rows.filter((r) => inScope(r.fromTeamId) || inScope(r.toTeamId));
  // which persons still exist decides link vs plain name
  const ids = [...new Set(scoped.map((r) => r.personId))];
  const alive = new Set((await prisma.person.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((p) => p.id));
  return scoped.map((r) => ({ ...r, personExists: alive.has(r.personId) }));
}
