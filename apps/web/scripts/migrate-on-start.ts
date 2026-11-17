import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";

/**
 * Apply the pending migrations, then exit. The container runs this before it
 * starts the server (see `Dockerfile.web`), so a deploy that carries a new
 * migration file needs no `db:migrate` by hand.
 *
 * It does nothing unless `MIGRATE_ON_START=true`. The setting is opt-in so
 * that an image started against a database it should not change leaves that
 * database alone.
 *
 * Pending migrations run in one transaction: all of them apply or none do. A
 * failure exits non-zero, and the container stops before the server starts.
 *
 * Reads and writes the same history as `bun run db:migrate`: the settings
 * below mirror `server/db/drizzle.config.ts`. There is no lock, so this
 * assumes one container starts at a time.
 */
const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../server/db/drizzle",
);

async function main() {
  if (process.env.MIGRATE_ON_START !== "true") {
    console.log('Migrations skipped: MIGRATE_ON_START is not "true".');
    return;
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await migrate(drizzle({ client }), {
      migrationsFolder,
      migrationsSchema: "drizzle",
      migrationsTable: "__drizzle_migrations",
    });
    console.log("Migrations are up to date.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Migrations failed; the server will not start.");
  console.error(err);
  process.exit(1);
});
