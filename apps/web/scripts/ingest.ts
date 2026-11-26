import { parseIngestArgs } from "../server/ingest/args";
import { runIngest, runTestIngest } from "../server/ingest/ingest";

async function main() {
  const { testCourses } = parseIngestArgs(process.argv.slice(2));
  if (testCourses !== undefined) {
    await runTestIngest(testCourses);
    return;
  }
  await runIngest();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
