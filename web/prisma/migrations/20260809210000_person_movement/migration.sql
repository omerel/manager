-- CreateEnum
CREATE TYPE "MovementKind" AS ENUM ('CREATED', 'MOVED', 'REMOVED', 'DEPARTED');

-- CreateTable
CREATE TABLE "PersonMovement" (
    "id" TEXT NOT NULL,
    "kind" "MovementKind" NOT NULL,
    "personId" TEXT NOT NULL,
    "personName" TEXT NOT NULL,
    "fromTeamId" TEXT,
    "fromPath" TEXT,
    "toTeamId" TEXT,
    "toPath" TEXT,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonMovement_at_idx" ON "PersonMovement"("at");

-- CreateIndex
CREATE INDEX "PersonMovement_fromTeamId_at_idx" ON "PersonMovement"("fromTeamId", "at");

-- CreateIndex
CREATE INDEX "PersonMovement_toTeamId_at_idx" ON "PersonMovement"("toTeamId", "at");

