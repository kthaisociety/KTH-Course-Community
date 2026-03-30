/**
 * Profiles the KOPPS API by sampling N courses and collecting unique values
 * per field, with occurrence counts and course lookup.
 *
 * "(missing)" means at least one course had no value for that field.
 *
 * Usage:
 *   npx tsx scripts/explore-api.ts
 *   npx tsx scripts/explore-api.ts --sample 100
 *   npx tsx scripts/explore-api.ts --sample all        (warning: ~5k API calls)
 *   npx tsx scripts/explore-api.ts --active-only
 *   npx tsx scripts/explore-api.ts --find STU1         (search all fields)
 *   npx tsx scripts/explore-api.ts --find examRound.examCode=STU1
 */

const KOPPS = "https://api.kth.se/api/kopps/v2";
const DELAY_MS = 150;

const sampleIdx = process.argv.indexOf("--sample");
const sampleArg = sampleIdx !== -1 ? process.argv[sampleIdx + 1] : undefined;
const SAMPLE: number | "all" =
  sampleArg === "all"
    ? "all"
    : sampleArg
      ? Number.parseInt(sampleArg, 10)
      : 300;

const ACTIVE_ONLY = process.argv.includes("--active-only");
const DEBUG = process.argv.includes("--debug");

const findIdx = process.argv.indexOf("--find");
const findArg = findIdx !== -1 ? process.argv[findIdx + 1] : undefined;
// --find STU1  →  field=undefined, value="STU1"
// --find examRound.examCode=STU1  →  field="examRound.examCode", value="STU1"
const FIND = findArg
  ? findArg.includes("=")
    ? { field: findArg.split("=")[0], value: findArg.split("=")[1] }
    : { field: undefined, value: findArg }
  : undefined;

// ---- fetch helpers ----------------------------------------------------------

async function fetchCourses() {
  const res = await fetch(`${KOPPS}/courses?l=en`);
  const data = await res.json();
  return data as {
    code: string;
    name: string;
    state: string;
    department: string;
  }[];
}

async function fetchDetail(code: string) {
  await new Promise((r) => setTimeout(r, DELAY_MS));
  const res = await fetch(`${KOPPS}/course/${code}/detailedinformation`);
  if (!res.ok) return null;
  return res.json() as Promise<Record<string, unknown>>;
}

// ---- accumulator ------------------------------------------------------------

// field → value → count
type Profile = Record<string, Map<string, number>>;
// "field=value" → Set of course codes
type CourseIndex = Map<string, Set<string>>;

function add(
  profile: Profile,
  index: CourseIndex,
  key: string,
  value: unknown,
  courseCode: string,
) {
  const v = value === null || value === undefined ? "(missing)" : String(value);
  if (!profile[key]) profile[key] = new Map();
  profile[key].set(v, (profile[key].get(v) ?? 0) + 1);
  const indexKey = `${key}=${v}`;
  if (!index.has(indexKey)) index.set(indexKey, new Set());
  index.get(indexKey)?.add(courseCode);
}

function profileDetail(
  p: Profile,
  index: CourseIndex,
  d: Record<string, unknown>,
  courseCode: string,
) {
  const a = (key: string, value: unknown) =>
    add(p, index, key, value, courseCode);

  // ---- course -----------------------------------------------------------------
  const course = d.course as Record<string, unknown> | undefined;
  if (course) {
    a("course.state", course.state);
    a("course.educationalLevelCode", course.educationalLevelCode);
    a("course.gradeScaleCode", course.gradeScaleCode);
    a("course.credits", course.credits);
    a("course.creditUnitAbbr", course.creditUnitAbbr);
    a("course.departmentCode", course.departmentCode);
    const dept = course.department as Record<string, unknown> | undefined;
    a("course.department.name", dept?.name);
  }

  // ---- roundInfos -------------------------------------------------------------
  const roundInfos = d.roundInfos as Record<string, unknown>[] | undefined;
  for (const r of roundInfos ?? []) {
    a("roundInfo.lectureCount", r.lectureCount);

    const round = r.round as Record<string, unknown> | undefined;
    if (round) {
      a("round.studyPace", round.studyPace);
      a("round.isPU", round.isPU);
      a("round.isVU", round.isVU);
      a("round.shortName", round.shortName);
      a("round.language", round.language);

      const startTerm = round.startTerm as Record<string, unknown> | undefined;
      a("round.startTerm", startTerm?.term);

      const startWeek = round.startWeek as Record<string, unknown> | undefined;
      a(
        "round.startWeek",
        startWeek ? `${startWeek.year}-W${startWeek.week}` : undefined,
      );

      const endWeek = round.endWeek as Record<string, unknown> | undefined;
      a(
        "round.endWeek",
        endWeek ? `${endWeek.year}-W${endWeek.week}` : undefined,
      );

      const tf = round.tutoringForm as Record<string, unknown> | undefined;
      a("round.tutoringForm", tf?.name);

      const tt = round.tutoringTimeOfDay as Record<string, unknown> | undefined;
      a("round.tutoringTimeOfDay", tt?.name);

      const terms = round.courseRoundTerms as
        | Record<string, unknown>[]
        | undefined;
      for (const t of terms ?? []) {
        a("round.formattedPeriodsAndCredits", t.formattedPeriodsAndCredits);
      }
    }
  }

  // ---- examinationSets --------------------------------------------------------
  const examSets = d.examinationSets as
    | Record<
        string,
        {
          examinationRounds?: {
            examCode?: string;
            title?: string;
            gradeScaleCode?: string;
            credits?: number;
          }[];
        }
      >
    | undefined;
  for (const set of Object.values(examSets ?? {})) {
    for (const round of set.examinationRounds ?? []) {
      a("examRound.examCode", round.examCode);
      a("examRound.gradeScaleCode", round.gradeScaleCode);
      a("examRound.credits", round.credits);
      if (round.examCode && round.title) {
        a("examRound.title", `${round.examCode}::${round.title}`);
      }
    }
  }

  // ---- mainSubjects -----------------------------------------------------------
  const subjects = d.mainSubjects as string[] | undefined;
  for (const s of subjects ?? []) a("mainSubjects", s);
}

// ---- main -------------------------------------------------------------------

async function main() {
  console.error("Fetching course list...");
  const allCourses = await fetchCourses();
  console.error(`Got ${allCourses.length} courses`);

  const filtered = ACTIVE_ONLY
    ? allCourses.filter((c) => c.state === "ESTABLISHED")
    : allCourses;
  if (ACTIVE_ONLY)
    console.error(`Filtered to ${filtered.length} active courses`);

  const shuffled = filtered.sort(() => Math.random() - 0.5);
  const courses = SAMPLE === "all" ? shuffled : shuffled.slice(0, SAMPLE);
  console.error(`Sampling ${courses.length} courses (--sample ${SAMPLE})`);

  const profile: Profile = {};
  const index: CourseIndex = new Map();
  let done = 0;
  let debugged = false;

  for (const course of courses) {
    const detail = await fetchDetail(course.code).catch(() => null);
    if (detail) {
      if (DEBUG && !debugged) {
        const roundInfos = detail.roundInfos as unknown[];
        if (roundInfos?.length) {
          console.error(
            "\n[debug] sample roundInfo:\n",
            JSON.stringify(roundInfos[0], null, 2),
          );
          debugged = true;
        }
      }
      profileDetail(profile, index, detail, course.code);
    }
    done++;
    if (done % 50 === 0) console.error(`  ${done}/${courses.length}`);
  }

  // ---- --find output ----------------------------------------------------------
  if (FIND) {
    const matches: Record<string, string[]> = {};
    for (const [indexKey, courseCodes] of index) {
      const [field, value] = indexKey.split(/=(.+)/); // split on first "=" only
      const valueMatches = value === FIND.value;
      const fieldMatches = !FIND.field || field === FIND.field;
      if (valueMatches && fieldMatches) {
        matches[indexKey] = [...courseCodes].sort();
      }
    }
    if (Object.keys(matches).length === 0) {
      console.error(`No matches found for: ${findArg}`);
    }
    console.log(JSON.stringify(matches, null, 2));
    return;
  }

  // ---- profile output ---------------------------------------------------------
  // Each field: { value: count } sorted by count descending
  const out = Object.fromEntries(
    Object.entries(profile)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, counts]) => [
        k,
        Object.fromEntries([...counts.entries()].sort(([, a], [, b]) => b - a)),
      ]),
  );

  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
