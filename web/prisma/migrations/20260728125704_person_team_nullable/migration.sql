-- DropForeignKey
ALTER TABLE "Person" DROP CONSTRAINT "Person_teamId_fkey";

-- AlterTable
ALTER TABLE "Person" ALTER COLUMN "teamId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "OrgNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
