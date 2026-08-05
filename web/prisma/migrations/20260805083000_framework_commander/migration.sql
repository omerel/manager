-- AlterTable
ALTER TABLE "User" ADD COLUMN     "commandsNodeId" TEXT;
-- CreateIndex
CREATE UNIQUE INDEX "User_commandsNodeId_key" ON "User"("commandsNodeId");
-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_commandsNodeId_fkey" FOREIGN KEY ("commandsNodeId") REFERENCES "OrgNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
