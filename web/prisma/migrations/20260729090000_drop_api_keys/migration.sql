-- Drop per-user API key columns (agent uses the machine Claude CLI login)
ALTER TABLE "User" DROP COLUMN IF EXISTS "apiKeyCiphertext";
ALTER TABLE "User" DROP COLUMN IF EXISTS "apiKeyLast4";
