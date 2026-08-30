-- AlterTable
ALTER TABLE "PointEvent" ADD COLUMN     "guideMime" TEXT,
ADD COLUMN     "guideName" TEXT,
ADD COLUMN     "guidePath" TEXT,
ADD COLUMN     "guideSize" INTEGER,
ADD COLUMN     "sourceEventId" TEXT;

-- AlterTable
ALTER TABLE "RecurringEvent" ADD COLUMN     "guideMime" TEXT,
ADD COLUMN     "guideName" TEXT,
ADD COLUMN     "guidePath" TEXT,
ADD COLUMN     "guideSize" INTEGER,
ADD COLUMN     "sourceEventId" TEXT;

-- AddForeignKey
ALTER TABLE "PointEvent" ADD CONSTRAINT "PointEvent_sourceEventId_fkey" FOREIGN KEY ("sourceEventId") REFERENCES "PointEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringEvent" ADD CONSTRAINT "RecurringEvent_sourceEventId_fkey" FOREIGN KEY ("sourceEventId") REFERENCES "RecurringEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
