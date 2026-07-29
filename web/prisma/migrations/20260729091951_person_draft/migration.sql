-- CreateTable
CREATE TABLE "PersonDraft" (
    "id" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "values" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonDraft_pkey" PRIMARY KEY ("id")
);
