import { prisma } from "@/lib/prisma";
import { WIPE_CATEGORIES, type WipeCategory } from "@/lib/dev-wipe-categories";
export { WIPE_CATEGORIES, type WipeCategory };

/**
 * Is the wipe tool available here? A development build, always; a shipped
 * image only when its runtime environment says so explicitly — the same shape
 * as DEV_USER_SWITCH. Server-side only: a non-NEXT_PUBLIC env read from a
 * client bundle would silently inline undefined.
 */
export function dataWipeEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_DATA_WIPE === "1";
}

/**
 * Development-only data wipe, by category. The schema's cascades carry the
 * children; each category names only its deletion ROOTS, and the returned
 * counts are root counts — what the user ticked, not the cascade totals.
 *
 * Deliberately untouched, always: User, AccessGrant, OrgNode, AppSetting,
 * ActivityLog, PersonFieldDef, ImportMapping — accounts, hierarchy,
 * configuration and audit are not "data" in this tool's sense.
 */
export async function wipeCategories(keys: WipeCategory[]): Promise<{ label: string; count: number }[]> {
  const ticked = WIPE_CATEGORIES.filter((c) => keys.includes(c.key));
  if (ticked.length === 0) return [];

  // one transaction: a half-wiped database is worse than either state
  return prisma.$transaction(async (tx) => {
    const counts: { label: string; count: number }[] = [];
    for (const c of ticked) {
      let count = 0;
      switch (c.key) {
        case "people": {
          count = (await tx.person.deleteMany()).count;
          // the people's plan copies AFTER the people, so the Person cascade
          // has already cleared the assignments that pointed at them
          await tx.careerPlan.deleteMany({ where: { isTemplate: false } });
          await tx.personDraft.deleteMany();
          await tx.personMovement.deleteMany();
          await tx.extractionProposal.deleteMany();
          await tx.importSnapshot.deleteMany();
          break;
        }
        case "career":
          count = (await tx.careerPlan.deleteMany()).count;
          break;
        case "chat":
          count = (await tx.agentRun.deleteMany({ where: { kind: "CHAT" } })).count;
          break;
        case "rules":
          count = (await tx.rule.deleteMany()).count;
          break;
        case "queries":
          count = (await tx.query.deleteMany()).count;
          break;
      }
      counts.push({ label: c.label, count });
    }
    return counts;
  });
}
