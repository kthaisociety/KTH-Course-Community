/**
 * Post-processes an api-profile.json file:
 *  1. Sorts all values by count descending
 *  2. For examRound.examCode: collapses entries to their 3-letter prefix and sums counts
 *
 * Usage:
 *   npx tsx scripts/summarize-profile.ts api-profile.json > api-profile-summary.json
 */

import { readFileSync } from "node:fs";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: npx tsx scripts/summarize-profile.ts <input.json>");
  process.exit(1);
}

const raw = JSON.parse(readFileSync(inputPath, "utf-8")) as Record<
  string,
  Record<string, number>
>;

function sortByCount(counts: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(counts).sort(([, a], [, b]) => b - a),
  );
}

function collapseToPrefix(
  counts: Record<string, number>,
  prefixLen: number,
): Record<string, number> {
  const collapsed: Record<string, number> = {};
  for (const [key, count] of Object.entries(counts)) {
    const prefix = key.slice(0, prefixLen);
    collapsed[prefix] = (collapsed[prefix] ?? 0) + count;
  }
  return collapsed;
}

// Build prefix→titles[] from "examRound.title" entries formatted as "TEN1::Tentamen"
function buildExamTitles(
  counts: Record<string, number>,
): Record<string, string[]> {
  const prefixToTitles: Record<string, Set<string>> = {};
  for (const key of Object.keys(counts)) {
    const [code, title] = key.split("::");
    if (code && title) {
      const prefix = code.slice(0, 3);
      if (!prefixToTitles[prefix]) prefixToTitles[prefix] = new Set();
      prefixToTitles[prefix].add(title);
    }
  }
  return Object.fromEntries(
    Object.entries(prefixToTitles)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, [...v].sort()]),
  );
}

const out: Record<string, unknown> = {};

for (const [field, counts] of Object.entries(raw)) {
  if (field === "examRound.examCode") {
    out[field] = sortByCount(collapseToPrefix(counts, 3));
  } else if (field === "examRound.title") {
    out["examCode->title"] = buildExamTitles(counts);
  } else {
    out[field] = sortByCount(counts);
  }
}

console.log(JSON.stringify(out, null, 2));
