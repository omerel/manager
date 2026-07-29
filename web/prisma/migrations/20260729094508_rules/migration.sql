-- CreateEnum
CREATE TYPE "RuleSchedule" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "RealizationKind" AS ENUM ('SCRIPT', 'FLOW');

-- AlterTable
ALTER TABLE "AgentRun" ADD COLUMN     "pinnedRun" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ruleId" TEXT;

-- CreateTable
CREATE TABLE "Rule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "schedule" "RuleSchedule" NOT NULL DEFAULT 'NONE',
    "nextRunAt" TIMESTAMP(3),
    "pinnedAt" TIMESTAMP(3),
    "realizationKind" "RealizationKind",
    "realization" TEXT,
    "goldenOutput" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rule_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "Rule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rule" ADD CONSTRAINT "Rule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
