-- AlterTable: add credential fields (nullable; real auth deferred)
ALTER TABLE "User" ADD COLUMN "username" TEXT;
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;

-- CreateIndex: username unique (nulls allowed)
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
