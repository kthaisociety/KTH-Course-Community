import { runIngest, runTestIngest } from "../server/ingest/ingest";

const args = process.argv.slice(2);
const test = args.includes("--test");

async function main() {
  if (test) {
    await runTestIngest();
    return;
  }
  await runIngest();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
