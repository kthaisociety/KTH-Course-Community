/**
 * The course source since KOPPS v2 closed (api.kth.se/api/kopps/v2 answers 404;
 * ADR 0012).
 *
 * Reads the JSON that KTH's own course pages embed and returns it in the shapes
 * `CoursesSchema` / `CourseDetailSchema` describe, so `ingest.ts` maps it as it
 * mapped KOPPS.
 *
 *   /student/kurser/org                 department codes (window.__compressedApplicationStore__)
 *   /student/kurser/intern-api/sok/sv   course codes per department
 *   /student/kurser/kurs/:code?l=sv|en  course, syllabi, rounds (window.__compressedData__DATA)
 *
 * None of these are documented APIs. Every payload is validated with zod, so a
 * change on KTH's side fails loudly instead of writing wrong rows.
 */
import type { z } from "zod";
import { plainText } from "../text/html";
import { decodeStore, KTH_BASE, mapPolitely } from "./programmes/kth-page";
import {
  CourseDetailSchema,
  CoursePageSchema,
  type CourseSchema,
  CourseSearchResponseSchema,
  CoursesSchema,
} from "./schemas";

const BASE = KTH_BASE;
const REQUEST_DELAY_MS = 200;
const REQUEST_TIMEOUT_MS = 30_000;
const RETRIES = 3;

type Course = z.infer<typeof CourseSchema>;
type CourseDetail = z.infer<typeof CourseDetailSchema>;
export type CoursePage = z.infer<typeof CoursePageSchema>;
type PageTerm = { year: number; semesterNumber: number };

// ---- embedded page data ----------------------------------------------------

export function extractEmbedded(html: string, variable: string): unknown {
  const match = html.match(
    new RegExp(`window\\.${variable}\\s*=\\s*"([^"]*)"`),
  );
  if (!match) throw new Error(`${variable} not found in page`);
  return JSON.parse(decodeURIComponent(match[1]));
}

/** Thrown for a page that came back without its course data. */
export class EmptyCoursePageError extends Error {}

export function parseCoursePage(html: string): CoursePage {
  const data = extractEmbedded(html, "__compressedData__DATA") as {
    courseData?: { courseInfo?: { course_code?: unknown } };
  };
  if (!data?.courseData?.courseInfo?.course_code) {
    throw new EmptyCoursePageError("course page has no course data");
  }
  return CoursePageSchema.parse(data.courseData);
}

/**
 * Under load kth.se sometimes answers 200 with a page that carries no course
 * data; 14 of 4,799 did on 2026-11-15, and all 14 were complete when fetched
 * again. Those are retried. A page that has data but fails the schema is not.
 */
async function fetchCoursePage(url: string): Promise<CoursePage> {
  for (let attempt = 1; ; attempt++) {
    try {
      return parseCoursePage(await fetchText(url));
    } catch (error) {
      if (!(error instanceof EmptyCoursePageError) || attempt >= RETRIES) {
        throw error;
      }
      await sleep(1000 * 2 ** attempt);
    }
  }
}

// ---- value mapping ----------------------------------------------------------

// KTH renders a missing field as this placeholder, in both languages.
const PLACEHOLDER =
  /^<i>(Ingen information tillagd|No information inserted)<\/i>$/;

function clean(value: string | null | undefined): string {
  const v = (value ?? "").trim();
  return PLACEHOLDER.test(v) ? "" : v;
}

/** One line of plain text from an HTML fragment (`plainText`, on one line). */
export function htmlToText(html: string): string {
  return plainText(html)
    .replace(/\s+/g, " ")
    .replace(/\s+([,.:;)])/g, "$1");
}

function parseNumber(value: string): number | undefined {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

/** "7,5 hp" -> { credits: 7.5, unit: "hp" }; undefined when it does not parse. */
export function parseCredits(label: string | null | undefined) {
  const m = (label ?? "").match(/^(\d+(?:[.,]\d+)?)\s*(\S+)/);
  const credits = m ? parseNumber(m[1]) : undefined;
  return credits === undefined || !m ? undefined : { credits, unit: m[2] };
}

/** KOPPS grade-scale codes, which the UI and tests use ("AF", "PF"). */
export function gradeScaleCode(scale: string | null | undefined): string {
  const s = (scale ?? "").replace(/\s/g, "");
  if (s === "A,B,C,D,E,FX,F") return "AF";
  if (s === "P,F") return "PF";
  return s;
}

/** KOPPS educational level codes, e.g. "BASIC" (see server/course/service.spec.ts). */
const LEVELS: Record<string, string> = {
  "1": "BASIC",
  "2": "ADVANCED",
  "3": "RESEARCH",
  "99": "PREPARATORY",
};

// KOPPS sent tutoring form and time as `{ name }`, and ingest stores the name.
// These names are inferred, not read from KOPPS data; ADR 0012 records it.
const TUTORING_FORM: Record<string, string> = { NML: "Normal", DST: "Distans" };
const TUTORING_TIME: Record<string, string> = {
  DAG: "Dagtid",
  KVÄ: "Kvällstid",
};

/**
 * "<ul><li>TEN1 - Tentamen, 7,5 hp, betygsskala: A, B, C, D, E, FX, F</li></ul>"
 * An item that does not have this shape is skipped and reported via `onSkip`.
 */
export function parseExaminations(
  html: string | null | undefined,
  onSkip: (item: string) => void = () => {},
) {
  const items = [...(html ?? "").matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) =>
    htmlToText(m[1]),
  );
  return items.flatMap((item) => {
    const m = item.match(
      /^(\S+)\s+-\s+(.*?),\s*(\d+(?:[.,]\d+)?)\s*\S+,\s*(?:betygsskala|grading scale):\s*(.+)$/,
    );
    if (!m) {
      onSkip(item);
      return [];
    }
    return [
      {
        examCode: m[1],
        title: m[2].trim(),
        credits: parseNumber(m[3]),
        gradeScaleCode: gradeScaleCode(m[4]),
      },
    ];
  });
}

/** "<p>HT 2026: P2 (7.5 hp)</p>" -> "P2 (7,5 hp)" */
export function formatPeriods(
  html: string | null | undefined,
): string | undefined {
  const text = htmlToText(html ?? "");
  if (!text) return undefined;
  return text
    .replace(/^[A-ZÅÄÖ]{2}\s+\d{4}:\s*/, "")
    .replace(/(\d)\.(\d)/g, "$1,$2");
}

const toTerm = (t: PageTerm | null | undefined) =>
  t ? t.year * 10 + t.semesterNumber : 0;

type Warn = (message: string) => void;

export function toCourseDetail(
  sv: CoursePage,
  en: CoursePage | undefined,
  warn: Warn = console.warn,
): CourseDetail {
  const info = sv.courseInfo;
  const code = info.course_code;

  const credits = parseCredits(info.course_credits_label);
  if (!credits) {
    warn(`${code}: credits "${info.course_credits_label ?? ""}" did not parse`);
  }
  const level = LEVELS[info.course_level_code ?? ""];
  if (!level) {
    warn(`${code}: unknown level code "${info.course_level_code ?? ""}"`);
  }

  const syllabi = [...sv.syllabusList].sort(
    (a, b) => toTerm(b.course_valid_from) - toTerm(a.course_valid_from),
  );

  const allRounds = Object.values(sv.roundsBySemester)
    .flat()
    .flatMap((r) =>
      r.round_course_term
        ? [{ ...r, term: r.round_course_term[0] * 10 + r.round_course_term[1] }]
        : [],
    );

  const roundInfos = allRounds
    .filter((r) => !r.round_is_cancelled)
    .map((r) => {
      const periods = formatPeriods(r.round_periods);
      const language = clean(r.round_tutoring_language);
      const form = r.round_tutoring_form ?? "";
      const time = r.round_tutoring_time ?? "";
      const pace = r.round_study_pace;
      return {
        schemaUrl: r.round_schedule || undefined,
        round: {
          startTerm: { term: r.term },
          // KOPPS sent these as flags. Here: a programme round when it belongs
          // to a programme; open to all (VU) when KTH shows an application link.
          isPU: Boolean(clean(r.round_part_of_programme)),
          isVU: Boolean(r.show_application_link),
          studyPace:
            pace && pace >= 1 ? Math.min(100, Math.round(pace)) : undefined,
          tutoringForm: form
            ? { name: TUTORING_FORM[form] ?? form }
            : undefined,
          tutoringTimeOfDay: time
            ? { name: TUTORING_TIME[time] ?? time }
            : undefined,
          language: language || undefined,
          courseRoundTerms: periods
            ? [{ formattedPeriodsAndCredits: periods }]
            : undefined,
        },
      };
    });

  const latest = syllabi[0];
  const examinationRounds = latest
    ? parseExaminations(latest.course_examination, (item) =>
        warn(`${code}: examination "${item}" did not parse`),
      )
    : [];

  return CourseDetailSchema.parse({
    course: {
      courseCode: code,
      departmentCode: info.course_department_code ?? "",
      department: { name: info.course_department ?? "" },
      educationalLevelCode: level ?? "",
      gradeScaleCode: gradeScaleCode(info.course_grade_scale),
      title: info.course_title,
      titleOther: en?.courseInfo.course_title ?? info.course_title,
      credits: credits?.credits ?? 0,
      creditUnitAbbr: credits?.unit ?? "",
      state: info.course_is_discontinued ? "DEACTIVATED" : "ESTABLISHED",
    },
    coveredRoundTerms: [...new Set(allRounds.map((r) => r.term))].sort(),
    roundInfos,
    examinationSets: latest
      ? { [String(toTerm(latest.course_valid_from))]: { examinationRounds } }
      : {},
    publicSyllabusVersions: syllabi.map((s) => ({
      validFromTerm: { term: toTerm(s.course_valid_from) },
      courseSyllabus: {
        goals: clean(s.course_goals),
        content: clean(s.course_content),
        eligibility: clean(s.course_eligibility),
      },
    })),
    mainSubjects: clean(info.course_main_subject)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  });
}

// ---- HTTP -------------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET with a timeout, retrying network errors and non-404 failures. */
export async function fetchText(url: string): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (res.ok) return await res.text();
      lastError = new Error(`HTTP ${res.status} ${url}`);
      if (res.status === 404) break;
    } catch (error) {
      lastError = error;
    }
    if (attempt < RETRIES) await sleep(1000 * 2 ** attempt);
  }
  throw lastError;
}

export async function getDepartmentCodes(): Promise<string[]> {
  const store = decodeStore(await fetchText(`${BASE}/org`));
  if (!store) throw new Error("no application store on /org");
  const raw = JSON.stringify([
    store.currentSchoolsWithDepartments,
    store.deprecatedSchoolsWithDepartments,
  ]);
  const codes = [
    ...new Set([...raw.matchAll(/"code":"([A-Z0-9]{1,5})"/g)].map((m) => m[1])),
  ].sort();
  if (codes.length === 0) throw new Error("no department codes on /org");
  return codes;
}

async function search(query: string) {
  return CourseSearchResponseSchema.parse(
    JSON.parse(await fetchText(`${BASE}/intern-api/sok/sv?${query}`)),
  );
}

// Pause between a worker's searches, as the programme ingest does (`mapPolitely`).
const SEARCH_PAUSE_MS = 100;

const DIGITS = "0123456789";
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const CODE_CHARS = DIGITS + LETTERS;

/**
 * The three-character patterns to start the code search from: every
 * two-character prefix in `codes`, followed by a digit. A letter follows only
 * where codes take one there, which on 2026-11-15 was 18 of 113 prefixes,
 * nearly all third-cycle `F` codes (FCA3006); `F` prefixes always get letters.
 */
export function patternSeeds(codes: string[]): string[] {
  const prefixes = new Map<string, boolean>();
  for (const code of codes) {
    const p = code.slice(0, 2);
    const letterThird = /[A-Z]/.test(code[2] ?? "") || p.startsWith("F");
    prefixes.set(p, (prefixes.get(p) ?? false) || letterThird);
  }
  return [...prefixes].flatMap(([p, letters]) =>
    [...(letters ? CODE_CHARS : DIGITS)].map((c) => p + c),
  );
}
const SEARCH_CONCURRENCY = 6;
// The search takes a code pattern of at least three characters, so patterns
// start at two-character prefixes plus one; course codes are at most 7 long.
const SEED_LENGTH = 3;
const MAX_PATTERN = 7;

/**
 * Every current course KTH's search will list.
 *
 * Two passes, because neither finds everything alone. By department misses
 * courses owned by a school-level code (DA232X is owned by `J`, which answers
 * "overflow"; DA248X by `JJ`, which answers nothing). By code pattern finds
 * those, but needs a three-character prefix to start from, so it expands every
 * two-character prefix the first pass saw or `knownCodes` holds (the
 * catalogue: VS2010 is owned by `TG`, which /org does not list, so only the
 * catalogue knows the `VS` prefix). A prefix that overflows is split one
 * character further. Discontinued courses are in neither: the search lists
 * current courses only. A course in a prefix family that neither pass nor the
 * catalogue has seen is missed.
 */
export async function getCourses(
  warn: Warn = console.warn,
  knownCodes: string[] = [],
): Promise<Course[]> {
  const byCode = new Map<string, Course>();
  const add = (
    results: { kod: string; benamning: string }[],
    department: string,
  ) => {
    for (const r of results) {
      if (byCode.has(r.kod)) continue;
      byCode.set(r.kod, {
        code: r.kod,
        name: r.benamning,
        department,
        // A placeholder that only lets the course through ingest's filter.
        // The stored state is the course page's (`CourseDetail.course.state`).
        state: "ESTABLISHED",
      });
    }
  };

  const departments = await getDepartmentCodes();
  await mapPolitely(
    departments,
    SEARCH_CONCURRENCY,
    async (department) => {
      const data = await search(`department=${encodeURIComponent(department)}`);
      if (data.errorCode && data.errorCode !== "overflow") {
        warn(`department ${department}: search returned "${data.errorCode}"`);
      }
      add(data.searchData?.results ?? [], department);
    },
    SEARCH_PAUSE_MS,
  );
  const byDepartment = byCode.size;

  let queue = patternSeeds([...byCode.keys(), ...knownCodes]);
  let patternQueries = 0;
  while (queue.length > 0) {
    const overflowed: string[] = [];
    await mapPolitely(
      queue,
      SEARCH_CONCURRENCY,
      async (pattern) => {
        patternQueries++;
        const data = await search(`pattern=${encodeURIComponent(pattern)}`);
        if (data.errorCode === "overflow") {
          if (pattern.length >= MAX_PATTERN) {
            warn(`pattern ${pattern}: overflow at maximum length`);
          } else {
            overflowed.push(pattern);
          }
          return;
        }
        // "unknown" can hide hits (AI3 answers it while AI30 lists 24 courses),
        // but it also answers prefixes with no courses at every length, so a
        // seed is split once and a longer pattern is taken as empty.
        if (data.errorCode === "unknown") {
          if (pattern.length === SEED_LENGTH) overflowed.push(pattern);
          return;
        }
        if (data.errorCode) {
          warn(`pattern ${pattern}: search returned "${data.errorCode}"`);
        }
        // The pattern also matches names; keep only codes it is a prefix of.
        add(
          (data.searchData?.results ?? []).filter((r) =>
            r.kod.startsWith(pattern),
          ),
          "",
        );
      },
      SEARCH_PAUSE_MS,
    );
    queue = overflowed.flatMap((p) => [...CODE_CHARS].map((c) => p + c));
  }

  console.log(
    `KTH course search: ${byDepartment} by department, ${byCode.size - byDepartment} more by code (${patternQueries} pattern queries)`,
  );
  return CoursesSchema.parse([...byCode.values()]);
}

export async function getCourseInformation(
  course: Course,
  warn: Warn = console.warn,
): Promise<CourseDetail> {
  await sleep(REQUEST_DELAY_MS);
  const code = encodeURIComponent(course.code);
  const [sv, en] = await Promise.all([
    fetchCoursePage(`${BASE}/kurs/${code}?l=sv`),
    fetchCoursePage(`${BASE}/kurs/${code}?l=en`).catch((error) => {
      warn(
        `${course.code}: English page failed, English title falls back to Swedish: ${String(error)}`,
      );
      return undefined;
    }),
  ]);
  return toCourseDetail(sv, en, warn);
}
