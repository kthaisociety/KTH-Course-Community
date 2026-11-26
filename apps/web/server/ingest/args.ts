/** How many random courses `--test` reads when it isn't given a number. */
export const DEFAULT_TEST_COURSES = 10;

/**
 * The ingest script's arguments: nothing for a full ingest, or `--test` for a
 * sample of random established courses. `--test 50` or `--test=50` sets the
 * sample's size.
 */
export function parseIngestArgs(args: string[]): { testCourses?: number } {
  const at = args.findIndex((a) => a === "--test" || a.startsWith("--test="));
  if (at === -1) return {};

  const arg = args[at];
  const next = args[at + 1];
  const raw = arg.startsWith("--test=")
    ? arg.slice("--test=".length)
    : next !== undefined && !next.startsWith("--")
      ? next
      : undefined;
  if (raw === undefined) return { testCourses: DEFAULT_TEST_COURSES };

  const count = Number(raw);
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(
      `--test takes a whole number of courses, at least 1; got "${raw}"`,
    );
  }
  return { testCourses: count };
}
