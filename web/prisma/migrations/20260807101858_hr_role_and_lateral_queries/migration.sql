-- CreateEnum
CREATE TYPE "QuerySenderKind" AS ENUM ('FRAMEWORK', 'STAFF');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'HR';

-- AlterTable
ALTER TABLE "Query" ADD COLUMN     "senderKind" "QuerySenderKind" NOT NULL DEFAULT 'FRAMEWORK';
