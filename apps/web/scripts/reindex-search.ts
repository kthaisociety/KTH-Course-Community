import { runSearchReindex } from "../server/ingest/ingest";

runSearchReindex().catch((error) => {
  console.error("Search reindex failed:", error);
  process.exit(1);
});
