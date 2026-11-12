import type {
  CourseDetails,
  CourseReviewStats,
  CourseRoundSummary,
  CourseStats,
  CourseSummary,
  CourseSummaryWithStats,
  ExaminationDistribution,
  ExamRoundSummary,
} from "@/types";
import {
  EXAMINATION_DISTRIBUTION_KEYS,
  EXAMINATION_DISTRIBUTION_LABELS,
} from "@/types";
import type {
  CourseLevel,
  CoursePlanFacts,
  PlanFactsResult,
} from "@/types/programme";
import type { SelectCourse } from "../db/schema";
import {
  getAggregatesByCourseCodes,
  type ReviewAggregate,
} from "../reviews/service";
import { getTakenCountsByCourseCodes } from "../taken/service";
import { courseNameKey } from "./name-key";
import { periodCredits } from "./periods";
import { readPrerequisites } from "./prerequisites";
import * as courseRepo from "./repository";

type ExaminationKey = (typeof EXAMINATION_DISTRIBUTION_KEYS)[number];

/** A course with no reviews at all: absent numbers, not zeroed ones. */
const NO_REVIEWS: CourseStats["reviews"] = null;

/** At most this many shares are named in an `examLabel`. */
const EXAM_LABEL_MAX_SHARES = 3;

/** The scale the card renders workload and learning on. One decimal, unscaled. */
function toOneDecimal(mean: number): number {
  return Math.round(mean * 10) / 10;
}

/**
 * Whole percentages that still add up to 100, by largest remainder.
 *
 * Every stored distribution adds up to 100, so their mean does too — but
 * rounding each share on its own does not, and a bar chart built from shares
 * summing to 99 has a visible gap. The leftover units go to the largest
 * fractional parts, ties broken by the order the form asks the questions in
 * so the same input always yields the same output.
 */
function toWholePercentages(
  means: Record<ExaminationKey, number>,
): ExaminationDistribution | null {
  const total = EXAMINATION_DISTRIBUTION_KEYS.reduce(
    (sum, key) => sum + means[key],
    0,
  );
  if (total <= 0) return null;

  const scaled = EXAMINATION_DISTRIBUTION_KEYS.map((key) => {
    const exact = (means[key] * 100) / total;
    return { key, whole: Math.floor(exact), remainder: exact % 1 };
  });

  let leftover = 100 - scaled.reduce((sum, share) => sum + share.whole, 0);
  for (const share of [...scaled].sort((a, b) => b.remainder - a.remainder)) {
    if (leftover <= 0) break;
    share.whole += 1;
    leftover -= 1;
  }

  return Object.fromEntries(
    scaled.map((share) => [share.key, share.whole]),
  ) as ExaminationDistribution;
}

/**
 * The card has room for a phrase, not a six-way chart, so it names only the
 * shares that carry the course: `"Labs 60% · Exam 40%"`. A zero share is left
 * out rather than printed as `0%`.
 */
function formatExamLabel(distribution: ExaminationDistribution): string | null {
  const named = EXAMINATION_DISTRIBUTION_KEYS.map((key, order) => ({
    key,
    order,
    percent: distribution[key],
  }))
    .filter((share) => share.percent > 0)
    .sort((a, b) => b.percent - a.percent || a.order - b.order)
    .slice(0, EXAM_LABEL_MAX_SHARES);

  if (named.length === 0) return null;

  return named
    .map(
      (share) =>
        `${EXAMINATION_DISTRIBUTION_LABELS[share.key]} ${share.percent}%`,
    )
    .join(" · ");
}

function toReviewStats(row: ReviewAggregate): CourseReviewStats {
  const examinationDistribution =
    row.examinationAnswerCount > 0 && row.examinationMeans
      ? toWholePercentages(row.examinationMeans)
      : null;

  return {
    reviewCount: row.reviewCount,
    happyCount: row.happyCount,
    happyPercent: Math.round((row.happyCount / row.reviewCount) * 100),
    workloadMean: toOneDecimal(row.workloadMean),
    learningMean: toOneDecimal(row.learningMean),
    approachTheoryPercent:
      row.approachTheoryAnswerCount > 0 && row.approachTheoryMean !== null
        ? Math.round(row.approachTheoryMean)
        : null,
    approachTheoryAnswerCount: row.approachTheoryAnswerCount,
    examinationDistribution,
    examinationAnswerCount: row.examinationAnswerCount,
    examLabel: examinationDistribution
      ? formatExamLabel(examinationDistribution)
      : null,
  };
}

/**
 * The aggregate numbers for a page of course cards, keyed by course code.
 *
 * Two grouped queries serve the whole page — one over `reviews`, one over
 * `user_taken_courses` — rather than one query per card. Each comes from the
 * domain that owns its table; assembling them into the card's figures is the
 * course domain's job, which is why the shaping lives here and the SQL does
 * not. Every requested code gets an entry, so a caller never has to
 * distinguish "not asked for" from "nothing to show".
 */
export async function getStatsByCodes(
  codes: string[],
): Promise<Map<string, CourseStats>> {
  const uniqueCodes = [...new Set(codes)];
  const stats = new Map<string, CourseStats>(
    uniqueCodes.map((code) => [code, { reviews: NO_REVIEWS, takenCount: 0 }]),
  );
  if (uniqueCodes.length === 0) return stats;

  const [reviewRows, takenRows] = await Promise.all([
    getAggregatesByCourseCodes(uniqueCodes),
    getTakenCountsByCourseCodes(uniqueCodes),
  ]);

  for (const row of reviewRows) {
    const entry = stats.get(row.courseCode);
    if (entry) entry.reviews = toReviewStats(row);
  }
  for (const row of takenRows) {
    const entry = stats.get(row.courseCode);
    if (entry) entry.takenCount = row.takenCount;
  }

  return stats;
}

export function getCourse(
  courseCode: string,
): Promise<SelectCourse | undefined> {
  return courseRepo.findByCode(courseCode);
}

export async function getSummary(
  courseCode: string,
): Promise<CourseSummaryWithStats | null> {
  const [course, rounds, exams, statsByCode] = await Promise.all([
    courseRepo.findByCode(courseCode),
    courseRepo.findRoundSummaries(courseCode),
    courseRepo.findExamCodes(courseCode),
    getStatsByCodes([courseCode]),
  ]);

  if (!course) return null;

  const startTerms = [...new Set(rounds.map((r) => r.startTerm))].sort(
    (a, b) => a - b,
  );
  const languages = [
    ...new Set(rounds.map((r) => r.language).filter((l): l is string => !!l)),
  ].sort();
  const examTypes = [...new Set(exams.map((e) => e.examCode))].sort();

  return {
    courseCode: course.code,
    titleEng: course.titleEng,
    currentStatus: course.state,
    credits: course.credits,
    creditUnit: course.creditUnit,
    department: course.department,
    startTerms,
    examTypes,
    languages,
    updatedAt: course.updatedAt.toISOString(),
    stats: statsByCode.get(courseCode) ?? {
      reviews: NO_REVIEWS,
      takenCount: 0,
    },
  };
}

/**
 * The most distinct names one lookup sends. A transcript is one student's
 * record and has far fewer rows; the bound keeps a crafted file from turning
 * one upload into a query with an unbounded parameter list.
 */
const MAX_NAME_LOOKUPS = 300;

/** A catalogue course as a by-name lookup returns it. */
export type CatalogueCourseName = {
  courseCode: string;
  titleEng: string;
  titleSwe: string;
  credits: number;
};

/**
 * The catalogue courses whose English or Swedish name could be one of
 * `names`, for the transcript import — Ladok's transcript prints names, not
 * codes.
 *
 * One query however many names there are, and none when there are none. The
 * match is loose on purpose (`courseNameKey`), so the result can hold courses
 * that only resemble a name; the caller decides which name really matches.
 */
export async function getCoursesByNames(
  names: string[],
): Promise<CatalogueCourseName[]> {
  const keys = [...new Set(names.map(courseNameKey))]
    .filter((key) => key !== "")
    .slice(0, MAX_NAME_LOOKUPS);
  if (keys.length === 0) return [];
  return courseRepo.findByNameKeys(keys);
}

/**
 * Catalogue fields only, for callers that are matching course codes rather
 * than rendering cards — the transcript import, and search before it hands
 * codes to Explore. The card numbers cost two more queries, so they are
 * `getStatsByCodes`, asked for separately by whoever actually shows them.
 */
export async function getSummariesByCodes(
  codes: string[],
): Promise<CourseSummary[]> {
  if (codes.length === 0) return [];

  const [courseRows, roundRows, examRows] = await Promise.all([
    courseRepo.findByCodes(codes),
    courseRepo.findRoundSummariesByCodes(codes),
    courseRepo.findExamCodesByCodes(codes),
  ]);

  const roundsByCode = new Map<string, typeof roundRows>();
  for (const r of roundRows) {
    const bucket = roundsByCode.get(r.courseCode) ?? [];
    bucket.push(r);
    roundsByCode.set(r.courseCode, bucket);
  }

  const examsByCode = new Map<string, typeof examRows>();
  for (const e of examRows) {
    const bucket = examsByCode.get(e.courseCode) ?? [];
    bucket.push(e);
    examsByCode.set(e.courseCode, bucket);
  }

  const byCode = new Map(courseRows.map((c) => [c.code, c]));

  return codes.flatMap((code) => {
    const course = byCode.get(code);
    if (!course) return [];

    const rounds = roundsByCode.get(code) ?? [];
    const exams = examsByCode.get(code) ?? [];
    const startTerms = [...new Set(rounds.map((r) => r.startTerm))].sort(
      (a, b) => a - b,
    );
    const languages = [
      ...new Set(rounds.map((r) => r.language).filter((l): l is string => !!l)),
    ].sort();
    const examTypes = [...new Set(exams.map((e) => e.examCode))].sort();

    return [
      {
        courseCode: course.code,
        titleEng: course.titleEng,
        currentStatus: course.state,
        credits: course.credits,
        creditUnit: course.creditUnit,
        department: course.department,
        startTerms,
        examTypes,
        languages,
        updatedAt: course.updatedAt.toISOString(),
      },
    ];
  });
}

export async function getDetails(
  courseCode: string,
): Promise<CourseDetails | null> {
  const [course, rounds, exams] = await Promise.all([
    courseRepo.findByCode(courseCode),
    courseRepo.findRoundDetails(courseCode),
    courseRepo.findExamDetails(courseCode),
  ]);

  if (!course) return null;

  const mappedRounds: CourseRoundSummary[] = rounds.map((r) => ({
    id: r.id,
    startTerm: r.startTerm,
    formattedPeriodsAndCredits: r.formattedPeriodsAndCredits,
    studyPace: r.studyPace,
    language: r.language,
    tutoringForm: r.tutoringForm,
    tutoringTime: r.tutoringTimeOfDay,
    isProgrammeCourse: r.isPU,
    schemaURL: r.schemaUrl,
  }));
  const mappedExams: ExamRoundSummary[] = exams.map((e) => ({
    examCode: e.examCode,
    title: e.title,
    credits: e.credits,
    gradeScaleCode: e.gradeScaleCode,
  }));

  return {
    courseCode: course.code,
    titleEng: course.titleEng,
    titleSwe: course.titleSwe,
    department: course.department,
    departmentCode: course.departmentCode,
    credits: course.credits,
    creditUnit: course.creditUnit,
    educationalLevel: course.educationalLevelCode,
    gradeScale: course.gradeScaleCode,
    goals: course.goals,
    content: course.content,
    eligibility: course.eligibility,
    rounds: mappedRounds,
    examinations: mappedExams,
  };
}

const LEVEL: Record<string, CourseLevel> = {
  BASIC: "B",
  ADVANCED: "A",
  PREPARATORY: "P",
  RESEARCH: "A",
};
const levelOf = (code: string | null): CourseLevel => LEVEL[code ?? ""] ?? "B";

/** The catalogue changes once per ingest, so one copy per server process is enough. */
let catalogueIndex: Promise<
  Map<string, { titleSwe: string; level: CourseLevel }>
> | null = null;
function getCatalogueIndex() {
  catalogueIndex ??= courseRepo
    .findCatalogueIndex()
    .then(
      (rows) =>
        new Map(
          rows.map((r) => [
            r.code,
            { titleSwe: r.titleSwe, level: levelOf(r.level) },
          ]),
        ),
    )
    .catch((error) => {
      catalogueIndex = null;
      throw error;
    });
  return catalogueIndex;
}

/**
 * Everything the study plan checks a course against: credits, level, rounds
 * with credits per period, and prerequisites read from the eligibility prose.
 * Read-only catalogue data, so nothing here is per user.
 */
export async function getPlanFacts(codes: string[]): Promise<PlanFactsResult> {
  if (codes.length === 0) return { courses: {}, refs: {} };
  const [courseRows, roundRows, index] = await Promise.all([
    courseRepo.findByCodes(codes),
    courseRepo.findPlanRoundsByCodes(codes),
    getCatalogueIndex(),
  ]);
  const catalogue = new Set(index.keys());
  const courses: Record<string, CoursePlanFacts> = {};
  const refs: PlanFactsResult["refs"] = {};
  for (const c of courseRows) {
    const reading = readPrerequisites(c.eligibility, c.code, catalogue);
    courses[c.code] = {
      code: c.code,
      titleSwe: c.titleSwe,
      titleEng: c.titleEng,
      credits: c.credits,
      level: levelOf(c.educationalLevelCode),
      department: c.department,
      rounds: roundRows
        .filter((r) => r.courseCode === c.code)
        .flatMap((r) => {
          const credits = periodCredits(
            r.formattedPeriodsAndCredits,
            c.credits,
          );
          return credits
            ? [
                {
                  startTerm: r.startTerm,
                  credits,
                  pace: r.studyPace,
                  isOpen: r.isVU,
                },
              ]
            : [];
        })
        .sort((a, b) => a.startTerm - b.startTerm),
      prerequisites: reading.groups,
      registeredCounts: reading.registeredCounts,
      eligibility: reading.text,
    };
    for (const g of reading.groups)
      for (const code of g.codes) {
        const hit = index.get(code);
        if (hit) refs[code] = hit;
      }
    refs[c.code] = {
      titleSwe: c.titleSwe,
      level: levelOf(c.educationalLevelCode),
    };
  }
  return { courses, refs };
}
