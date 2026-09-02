import { getDb } from "../server/db";
import { runNeonIngest, runNeonTest } from "../server/ingest/ingest";

const args = process.argv.slice(2);
const test = args.includes("--test");

async function main() {
  const db = getDb();
  if (test) {
    await runNeonTest(db);
    return;
  }
  await runNeonIngest(db);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
