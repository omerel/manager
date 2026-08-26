-- AlterTable
ALTER TABLE "PointEvent" ADD COLUMN     "createdByName" TEXT,
ADD COLUMN     "personal" BOOLEAN NOT NULL DEFAULT false;
