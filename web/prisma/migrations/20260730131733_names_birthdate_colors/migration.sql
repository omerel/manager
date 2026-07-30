-- AlterTable
ALTER TABLE "CumulativeMetric" ADD COLUMN     "color" TEXT;

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "firstName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "lastName" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "RecurringEvent" ADD COLUMN     "color" TEXT;
