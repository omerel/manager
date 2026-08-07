## Context

The sweep that produced this change ran everything that can be run: tsc and build (clean), all 21 verification suites (17 green), lint (3 errors, 3 warnings), a model-by-model comparison of the schema against the backup's table list, and a read of every doc surface against the running system.

The backup gap was confirmed mechanically: every `model` in `schema.prisma`, lowercased, grepped against `portability.ts` — three misses. The cascade risk is structural: restore begins by wiping parents (`orgNode.deleteMany`), and `Query.senderNodeId` declares `onDelete: Cascade`, so even queries that survived an old bundle's import are destroyed by the next restore.

The three verification failures were each traced to root cause before deciding anything:

| suite | traced to |
|---|---|
| placement-anchor | an independent probe of the same engine passed cleanly; the script's `findFirstOrThrow` has no `orderBy` and no guards, so demo-data regeneration handed it a subject whose occurrences clip at end-of-service, misaligning an index-paired comparison. The waiver assertion separately assumes a veteran and got a fresh recruit |
| intake | UI renders "אישור — עובד חדש"; script expects "עובד חדש — לאישור"; no spec pins either |
| delete-authz | the form label carries a "— אופציונלי" suffix; the canonical list in `person-schema.ts` doesn't; the check requires containment across the two surfaces |

## Goals / Non-Goals

**Goals:**

- A backup→restore round trip preserves commander queries and the activity log, byte-for-count.
- Every verification suite green, for reasons that hold across demo-data regeneration.
- No documented claim that contradicts the running system.
- Lint at zero so the next real warning is visible.

**Non-Goals:**

- Generating the backup table list from the schema automatically. Worth considering after a third drift — but it changes how restore ordering is expressed, which is exactly the delicate part, and this change is a sweep, not a redesign. Recorded as the standing risk instead.
- Pinning UI microcopy in specs. The fix is single-sourcing within the code, not freezing Hebrew strings into requirements.
- Any behavioural change to queries, activity log, or the anchor engine. Everything here restores agreement between parts; nothing alters what the system does.

## Decisions

### D1 — Bundle order follows the FK graph, and ActivityLog is the easy one

Dump adds `query`, `queryTarget`, `activityLog`. Wipe order: `queryTarget` → `query` before their parents; `activityLog` anywhere, since it deliberately has **no foreign keys at all** ("an entry outlives the account that made it"). Restore order: after `orgNode` and `user` exist — `query` (needs sender node, author `SetNull`-safe), then `queryTarget` (needs query and node), `activityLog` anywhere.

An old bundle without the new keys restores unchanged: `rows(t, "query")` on a missing key yields an empty array, which is precisely the pre-change behaviour. No bundle version bump — the shape grew, nothing existing moved.

### D2 — Wording drifts get a single source, not a corrected copy

Fixing the two strings in place would repair today's mismatch and leave the mechanism that produced it. Instead each pair gets one exporting module and two readers:

- the intake action-link label lives beside the intake code and is imported by `verify-intake`;
- the end-of-service label already has a canonical home — `person-schema.ts` `CORE_FIELDS` — so the form composes "(תת״ש) — אופציונלי" presentation *around* the canonical string rather than restating it, and the containment check passes by construction.

This is the established pattern (`eval-scale.ts` exists for exactly this reason, and the card-schema drift is name-checked in its doc comment).

### D3 — The placement-anchor fixture is guarded, not loosened

The temptation is to weaken the assertions (compare sets instead of indices). Rejected: the index-aligned comparison is the strong form of the claim — *nothing appeared, disappeared or reordered; every date moved by exactly the shift*. The fix is to pick a subject for whom the strong claim is meant to hold: deterministic `orderBy`, no `endOfServiceDate`, no waiver overrides, and for the axis-comparison block, a subject whose recruitment genuinely precedes the synthetic placement — asserting the precondition explicitly so a future data reshuffle fails with "fixture unsuitable", not with a false engine accusation.

### D4 — `Date.now()` moves out of render, not out of the lint

The three errors are real per the React compiler's rules even though today's pages are dynamic server components. Each page computes `now` once at the top of the request and threads it — the same discipline `computePersonGaps(person, today)` already follows. Suppressing the rule instead would hide the next genuinely impure call.

### D5 — The spec correction is a delta, not a drive-by edit

The false rationale in `people-registry` ("recruitment date, since plan offsets anchor to it") is fixed through this change's delta with a MODIFIED requirement, keeping the correction in the archive trail. The requirement keeps recruitment date mandatory — it is service history and appears on the card — but says so for the true reason.

## Risks / Trade-offs

- **The table list can drift a fourth time** → unmitigated by this change, deliberately (see Non-Goals). The verification suite now counts queries and log entries across the round trip, so the *next* drift fails a test instead of losing data silently.
- **Single-sourcing labels adds indirection for two strings** → accepted; the alternative recurs. Kept to the two proven-drifting pairs rather than generalised speculatively.
- **README rewritten by hand can rot again** → true and accepted; a generated feature list is not worth its machinery for a repo with one README.

## Migration Plan

None. No schema change. Bundles made before this change restore exactly as before; bundles made after include the new tables.

## Open Questions

None.
