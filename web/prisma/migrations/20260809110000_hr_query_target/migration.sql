-- AlterTable
ALTER TABLE "QueryTarget" ADD COLUMN     "targetUserId" TEXT,
ALTER COLUMN "nodeId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "QueryTarget_queryId_targetUserId_key" ON "QueryTarget"("queryId", "targetUserId");

-- AddForeignKey
ALTER TABLE "QueryTarget" ADD CONSTRAINT "QueryTarget_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

