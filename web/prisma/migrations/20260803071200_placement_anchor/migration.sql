-- The career-plan timeline moves from recruitment to UNIT PLACEMENT.
--
-- A plan describes a path in this unit, so anchoring it to recruitment measured
-- time served elsewhere as though it had been served here. This migration makes
-- the new anchor exist and be correct for today's data; the code changes in the
-- same commit make every offset resolve through it.

-- How a recurring event is drawn: markers on the axis, or a card per occurrence.
CREATE TYPE "RecurringDisplay" AS ENUM ('MARKER', 'CARD');
ALTER TABLE "RecurringEvent" ADD COLUMN "display" "RecurringDisplay" NOT NULL DEFAULT 'MARKER';

-- placementDate arrives nullable, is filled, and only then becomes required, so
-- no row is ever momentarily invalid.
ALTER TABLE "Person" ADD COLUMN "placementDate" TIMESTAMP(3);

-- The backfill is the assumption the system already made implicitly — that
-- service here began at recruitment. Writing it down makes it visible and
-- correctable, and guarantees every computed date and gap is unchanged today.
UPDATE "Person" SET "placementDate" = "recruitmentDate";

ALTER TABLE "Person" ALTER COLUMN "placementDate" SET NOT NULL;

-- The waiver line records how far along their path a person already was when a
-- plan was handed to them. It must be measured on the same axis the plan uses,
-- so it moves to the placement date. With the backfill above this is an
-- identity — deliberately run now, so the path is exercised while it cannot
-- change anything, rather than first meeting real data years from now.
UPDATE "PlanAssignment" a
SET "waiverOffsetMonths" = GREATEST(
      0,
      (DATE_PART('year', AGE(a."assignedAt", p."placementDate")) * 12
       + DATE_PART('month', AGE(a."assignedAt", p."placementDate")))::int
    )
FROM "Person" p
WHERE p.id = a."personId";
