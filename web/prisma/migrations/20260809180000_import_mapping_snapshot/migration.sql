-- CreateTable
CREATE TABLE "ImportMapping" (
    "id" TEXT NOT NULL,
    "headersHash" TEXT NOT NULL,
    "mapping" JSONB NOT NULL,
    "dateFormats" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportSnapshot" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "headersHash" TEXT NOT NULL,
    "rows" JSONB NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" TEXT NOT NULL,
    "uploadedByName" TEXT NOT NULL,

    CONSTRAINT "ImportSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImportMapping_headersHash_key" ON "ImportMapping"("headersHash");

