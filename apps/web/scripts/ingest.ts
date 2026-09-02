import { runNeonIngest, runNeonTest } from "../server/ingest/ingest";

const args = process.argv.slice(2);
const test = args.includes("--test");

async function main() {
  if (test) {
    await runNeonTest();
    return;
  }
  await runNeonIngest();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
