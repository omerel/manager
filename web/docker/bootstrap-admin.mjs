// First-boot bootstrap: when the users table is empty, create the first Admin
// from ADMIN_USERNAME / ADMIN_PASSWORD / ADMIN_EMAIL. Idempotent — skipped the
// moment any user exists. Plain Node + pg (the Prisma client is TS, compiled
// into the Next build, and unusable from a standalone boot script).
import { Client } from "pg";
import { scryptSync, randomBytes } from "crypto";

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  const { rows } = await client.query('SELECT COUNT(*)::int AS n FROM "User"');
  if (rows[0].n > 0) {
    console.log(`[bootstrap] ${rows[0].n} users exist — skipping bootstrap`);
  } else {
    const username = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;
    const email = process.env.ADMIN_EMAIL || (username ? `${username}@local` : null);
    if (!username || !password) {
      console.warn(
        "[bootstrap] WARNING: user table is empty but ADMIN_USERNAME/ADMIN_PASSWORD are not set — " +
          "no one can log in until these envs are provided or a full backup is imported.",
      );
    } else {
      // hash format must match src/lib/password.ts exactly: "<salt-hex>:<scrypt-hex>"
      const salt = randomBytes(16).toString("hex");
      const passwordHash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
      const id = "adm" + randomBytes(12).toString("hex");
      await client.query(
        'INSERT INTO "User"(id, name, email, username, "passwordHash", role) VALUES($1,$2,$3,$4,$5,$6)',
        [id, username, email, username, passwordHash, "ADMIN"],
      );
      console.log(`[bootstrap] admin "${username}" created — log in and import a bundle to populate the system`);
    }
  }
} finally {
  await client.end();
}
