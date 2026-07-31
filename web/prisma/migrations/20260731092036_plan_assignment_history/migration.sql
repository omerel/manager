-- CreateEnum
CREATE TYPE "CarryOverKind" AS ENUM ('METRIC', 'POINT');

-- CreateTable
CREATE TABLE "PlanAssignment" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "waiverOffsetMonths" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,

    CONSTRAINT "PlanAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanWaiver" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "pointEventId" TEXT,
    "checkpointId" TEXT,
    "recurringEventId" TEXT,
    "occurrenceOffset" INTEGER,
    "waived" BOOLEAN NOT NULL,

    CONSTRAINT "PlanWaiver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanCarryOver" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "kind" "CarryOverKind" NOT NULL,
    "fromPlanName" TEXT NOT NULL,
    "fromLabel" TEXT NOT NULL,
    "toMetricId" TEXT,
    "toPointEventId" TEXT,
    "value" DOUBLE PRECISION,
    "originalDate" TIMESTAMP(3),

    CONSTRAINT "PlanCarryOver_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanAssignment_planId_key" ON "PlanAssignment"("planId");

-- CreateIndex
CREATE INDEX "PlanAssignment_personId_endedAt_idx" ON "PlanAssignment"("personId", "endedAt");

-- AddForeignKey
ALTER TABLE "PlanAssignment" ADD CONSTRAINT "PlanAssignment_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanAssignment" ADD CONSTRAINT "PlanAssignment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "CareerPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanWaiver" ADD CONSTRAINT "PlanWaiver_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "PlanAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanWaiver" ADD CONSTRAINT "PlanWaiver_pointEventId_fkey" FOREIGN KEY ("pointEventId") REFERENCES "PointEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanWaiver" ADD CONSTRAINT "PlanWaiver_checkpointId_fkey" FOREIGN KEY ("checkpointId") REFERENCES "MetricCheckpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanWaiver" ADD CONSTRAINT "PlanWaiver_recurringEventId_fkey" FOREIGN KEY ("recurringEventId") REFERENCES "RecurringEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanCarryOver" ADD CONSTRAINT "PlanCarryOver_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "PlanAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
