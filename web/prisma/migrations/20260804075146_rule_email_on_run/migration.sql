-- A rule can mail each run's output to its owner. Default false: every rule that
-- predates this column keeps its current silent behaviour, and no one starts
-- receiving mail without having asked for it.
ALTER TABLE "Rule" ADD COLUMN "emailOnRun" BOOLEAN NOT NULL DEFAULT false;
