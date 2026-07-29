-- CreateEnum
CREATE TYPE "RecurringStopMode" AS ENUM ('UNTIL_OFFSET', 'END_OF_SERVICE');

-- CreateTable
CREATE TABLE "CareerPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareerPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointEvent" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "offsetMonths" INTEGER NOT NULL,

    CONSTRAINT "PointEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CumulativeMetric" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,

    CONSTRAINT "CumulativeMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricCheckpoint" (
    "id" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "offsetMonths" INTEGER NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "MetricCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringEvent" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "intervalMonths" INTEGER NOT NULL,
    "stopMode" "RecurringStopMode" NOT NULL,
    "stopOffsetMonths" INTEGER,

    CONSTRAINT "RecurringEvent_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PointEvent" ADD CONSTRAINT "PointEvent_planId_fkey" FOREIGN KEY ("planId") REFERENCES "CareerPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CumulativeMetric" ADD CONSTRAINT "CumulativeMetric_planId_fkey" FOREIGN KEY ("planId") REFERENCES "CareerPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricCheckpoint" ADD CONSTRAINT "MetricCheckpoint_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "CumulativeMetric"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringEvent" ADD CONSTRAINT "RecurringEvent_planId_fkey" FOREIGN KEY ("planId") REFERENCES "CareerPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
