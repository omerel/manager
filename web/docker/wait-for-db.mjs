// Wait for DATABASE_URL to accept connections (managed DB may come up later).
import { Client } from "pg";

const RETRIES = 60;
const DELAY_MS = 2000;

for (let i = 1; i <= RETRIES; i++) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    await client.query("SELECT 1");
    await client.end();
    console.log("[wait-for-db] database is up");
    process.exit(0);
  } catch (e) {
    await client.end().catch(() => {});
    console.log(`[wait-for-db] attempt ${i}/${RETRIES} failed (${e.code ?? e.message}); retrying…`);
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }
}
console.error("[wait-for-db] database not reachable — giving up");
process.exit(1);
