-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "photoPath" TEXT;

-- CreateTable
CREATE TABLE "ExtractionProposal" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtractionProposal_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ExtractionProposal" ADD CONSTRAINT "ExtractionProposal_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
