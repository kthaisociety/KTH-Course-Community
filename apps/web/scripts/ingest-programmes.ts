/**
 * Rebuilds the study plan's programme data from kth.se.
 *
 *   bun run ingest:programmes            # running year from today's date
 *   bun run ingest:programmes --cache .programme-cache
 *
 * Writes `server/programme/data/`. Commit the result: the app reads it from
 * disk and makes no request to kth.se at runtime.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildProgrammeData } from "../server/ingest/programmes/build";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const now = new Date();
// The academic year turns in August: before then we are still in the one that began last autumn.
const runningYear =
  Number(flag("--year")) ||
  (now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1);

await buildProgrammeData({
  outDir: path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../server/programme/data",
  ),
  runningYear,
  cacheDir: flag("--cache"),
  log: (line) => console.log(line),
});
