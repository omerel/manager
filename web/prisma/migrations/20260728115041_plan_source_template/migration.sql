-- AlterTable
ALTER TABLE "CareerPlan" ADD COLUMN     "sourceTemplateId" TEXT;

-- AddForeignKey
ALTER TABLE "CareerPlan" ADD CONSTRAINT "CareerPlan_sourceTemplateId_fkey" FOREIGN KEY ("sourceTemplateId") REFERENCES "CareerPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
