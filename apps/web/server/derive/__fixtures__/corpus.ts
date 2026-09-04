import { readFileSync } from "node:fs";

/**
 * A 300-course sample of the syllabus prose held in Neon, captured 2026-09-04
 * and committed verbatim: HTML tags and numeric entities exactly as stored.
 *
 * KOPPS is deactivated, so `courses.goals`, `courses.content` and
 * `courses.eligibility` can never be re-fetched. This file exists so that
 * prompt iteration for the derive stages never again depends on database
 * access or on KTH's uptime.
 *
 * How the 300 were chosen, and what the whole corpus looks like:
 * docs/schema_docs/corpus-census.md.
 */
export type CorpusCourse = {
  code: string;
  departmentCode: string;
  titleSwe: string;
  titleEng: string;
  /**
   * Raw syllabus prose, verbatim. The columns are nullable, but no row in
   * `courses` is null: an absent field is stored as the empty string.
   */
  goals: string;
  content: string;
  eligibility: string;
};

let cached: CorpusCourse[] | undefined;

/** Read the committed corpus sample. Cached, because it is ~600 KB of JSON. */
export function loadCorpusFixture(): CorpusCourse[] {
  cached ??= JSON.parse(
    readFileSync(new URL("./corpus.json", import.meta.url), "utf8"),
  ) as CorpusCourse[];
  return cached;
}
