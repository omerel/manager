-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('TEXT', 'DATE', 'NUMBER', 'ENUM');

-- AlterTable
ALTER TABLE "CareerPlan" ADD COLUMN     "isTemplate" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "assignedPlanId" TEXT;

-- CreateTable
CREATE TABLE "PersonFieldDef" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "FieldType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" TEXT[],
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PersonFieldDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonFieldValue" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "fieldDefId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PersonFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointProgress" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "pointEventId" TEXT NOT NULL,
    "doneOn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PointProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricReading" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetricReading_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PersonFieldDef_key_key" ON "PersonFieldDef"("key");

-- CreateIndex
CREATE UNIQUE INDEX "PersonFieldValue_personId_fieldDefId_key" ON "PersonFieldValue"("personId", "fieldDefId");

-- CreateIndex
CREATE UNIQUE INDEX "PointProgress_personId_pointEventId_key" ON "PointProgress"("personId", "pointEventId");

-- CreateIndex
CREATE UNIQUE INDEX "MetricReading_personId_metricId_key" ON "MetricReading"("personId", "metricId");

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_assignedPlanId_fkey" FOREIGN KEY ("assignedPlanId") REFERENCES "CareerPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonFieldValue" ADD CONSTRAINT "PersonFieldValue_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonFieldValue" ADD CONSTRAINT "PersonFieldValue_fieldDefId_fkey" FOREIGN KEY ("fieldDefId") REFERENCES "PersonFieldDef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointProgress" ADD CONSTRAINT "PointProgress_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointProgress" ADD CONSTRAINT "PointProgress_pointEventId_fkey" FOREIGN KEY ("pointEventId") REFERENCES "PointEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricReading" ADD CONSTRAINT "MetricReading_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricReading" ADD CONSTRAINT "MetricReading_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "CumulativeMetric"("id") ON DELETE CASCADE ON UPDATE CASCADE;
