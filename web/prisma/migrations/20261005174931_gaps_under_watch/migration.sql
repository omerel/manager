-- AlterTable
ALTER TABLE "PointProgress" ALTER COLUMN "doneOn" DROP NOT NULL;

-- CreateTable
CREATE TABLE "WatchMark" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "markedById" TEXT,

    CONSTRAINT "WatchMark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WatchMark_personId_itemKey_key" ON "WatchMark"("personId", "itemKey");

-- AddForeignKey
ALTER TABLE "WatchMark" ADD CONSTRAINT "WatchMark_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchMark" ADD CONSTRAINT "WatchMark_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
