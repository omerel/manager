// Drop every table in the database, so the next container boot recreates the
// schema from scratch (migrate deploy runs all migrations, bootstrap-admin
// creates the first admin).
//
// This destroys everything: people, plans, evaluations, users, settings. The
// uploads volume is NOT touched — files stay on disk with nothing referencing
// them. Run manually, never from the entrypoint.
//
//   node docker/reset-db.mjs --yes
import { Client } from "pg";

const confirmed = process.argv.includes("--yes") || process.env.RESET_CONFIRM === "yes";

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

// what is about to be destroyed, named and counted, before anything happens
const { rows: tables } = await client.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name
`);

if (tables.length === 0) {
  console.log("[reset-db] the public schema holds no tables — nothing to drop");
  await client.end();
  process.exit(0);
}

console.log(`[reset-db] ${tables.length} tables in "public":`);
let total = 0;
for (const { table_name: name } of tables) {
  const { rows } = await client.query(`SELECT count(*)::int AS n FROM "${name}"`);
  total += rows[0].n;
  console.log(`  ${String(rows[0].n).padStart(7)}  ${name}`);
}
console.log(`[reset-db] ${total} rows in total.`);

if (!confirmed) {
  console.error(
    "\n[reset-db] refusing to drop anything without --yes (or RESET_CONFIRM=yes).\n" +
      "[reset-db] a full backup can be downloaded first from: הגדרות מערכת ← גיבוי ונתונים.",
  );
  await client.end();
  process.exit(1);
}

// DROP SCHEMA takes the tables, the enums and _prisma_migrations together, so
// the next boot is indistinguishable from a first install.
await client.query("DROP SCHEMA public CASCADE");
await client.query("CREATE SCHEMA public");
console.log(`[reset-db] dropped ${tables.length} tables (${total} rows). The next start will recreate the schema.`);
await client.end();
