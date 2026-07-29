-- CreateTable
CREATE TABLE "EvalEntry" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "recurringEventId" TEXT,
    "occurrenceOffset" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EvalEntry_personId_recurringEventId_occurrenceOffset_key" ON "EvalEntry"("personId", "recurringEventId", "occurrenceOffset");

-- AddForeignKey
ALTER TABLE "EvalEntry" ADD CONSTRAINT "EvalEntry_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvalEntry" ADD CONSTRAINT "EvalEntry_recurringEventId_fkey" FOREIGN KEY ("recurringEventId") REFERENCES "RecurringEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "EvalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
