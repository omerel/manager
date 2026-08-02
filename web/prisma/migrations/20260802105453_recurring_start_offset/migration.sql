-- RecurringEvent gains a start offset: months from recruitment of the FIRST
-- occurrence (the cycle runs start, start+interval, … ≤ stop).
--
-- Backfill = intervalMonths. The old unroll began at one interval after
-- recruitment, so start = interval reproduces every existing event's schedule
-- exactly — no occurrence, gap, waiver or filled slot moves. Verified by
-- byte-comparing full gap snapshots taken before and after this migration.
ALTER TABLE "RecurringEvent" ADD COLUMN "startOffsetMonths" INTEGER NOT NULL DEFAULT 0;
UPDATE "RecurringEvent" SET "startOffsetMonths" = "intervalMonths";
ALTER TABLE "RecurringEvent" ALTER COLUMN "startOffsetMonths" DROP DEFAULT;
