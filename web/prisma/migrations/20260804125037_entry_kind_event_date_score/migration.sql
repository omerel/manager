-- An entry gains: what kind it is, WHEN THE EVENT HAPPENED (as against when it
-- was typed), and an optional 1-5 assessment for interviews.

CREATE TYPE "EvalEntryKind" AS ENUM ('FREE', 'INTERVIEW');

-- FREE by default: a mislabelled free entry is visible and fixable, whereas
-- defaulting to INTERVIEW would silently manufacture interviews.
ALTER TABLE "EvalEntry" ADD COLUMN "kind" "EvalEntryKind" NOT NULL DEFAULT 'FREE';

-- Interviews only, and optional — an unrated interview carries no value rather
-- than one nobody chose.
ALTER TABLE "EvalEntry" ADD COLUMN "score" INTEGER;

-- eventDate arrives nullable, is filled, and only then becomes required, so no
-- row is ever momentarily invalid.
ALTER TABLE "EvalEntry" ADD COLUMN "eventDate" TIMESTAMP(3);

-- The backfill is not a guess: createdAt is exactly what the page has been
-- displaying as the event's date all along, so every entry reads on the day
-- this ships as it did the day before.
UPDATE "EvalEntry" SET "eventDate" = "createdAt";

ALTER TABLE "EvalEntry" ALTER COLUMN "eventDate" SET NOT NULL;
