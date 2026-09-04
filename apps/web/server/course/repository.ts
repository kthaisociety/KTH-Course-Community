import { count, eq, inArray, sql } from "drizzle-orm";
import type { EXAMINATION_DISTRIBUTION_KEYS } from "@/types";
import { db } from "../db";
import {
  courseExaminations,
  courseRounds,
  courses,
  reviews,
  userTakenCourses,
} from "../db/schema";

type ExaminationKey = (typeof EXAMINATION_DISTRIBUTION_KEYS)[number];

/**
 * One course's reviews, reduced by PostgreSQL. Means arrive unrounded and
 * unscaled; the service decides display precision.
 *
 * `AVG` and `COUNT(column)` both ignore SQL `NULL`, which is exactly the rule
 * "I don't remember" needs: a reviewer who did not answer is left out of the
 * mean instead of being counted as a zero. The `*AnswerCount` fields are how
 * many reviewers did answer, so the UI can say what a mean is over.
 */
export type ReviewAggregateRow = {
  courseCode: string;
  reviewCount: number;
  happyCount: number;
  workloadMean: number;
  learningMean: number;
  /** `null` when no reviewer of this course remembered. */
  approachTheoryMean: number | null;
  approachTheoryAnswerCount: number;
  examinationAnswerCount: number;
  /** `null` when no reviewer of this course remembered. */
  examinationMeans: Record<ExaminationKey, number> | null;
};

export type TakenCountRow = {
  courseCode: string;
  takenCount: number;
};

/**
 * The mean of one examination share across the reviews that recorded a
 * distribution at all.
 *
 * The `CASE` keeps every key averaged over the same denominator: a row with no
 * distribution drops out of all six means, but a row that has one contributes
 * to all six even if a key were somehow missing from the stored object. Were
 * each key averaged independently, the six means could end up over different
 * sets of reviewers and no longer add up to 100.
 */
function examinationShareMean(key: ExaminationKey) {
  return sql<string | null>`avg(
    case
      when ${reviews.examinationDistribution} is not null
      then coalesce((${reviews.examinationDistribution} ->> ${key}::text)::numeric, 0)
    end
  )`;
}

/** `numeric` and `bigint` come back from the driver as strings. */
function toNumber(value: string | number | null): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function toNullableNumber(value: string | number | null): number | null {
  return value === null ? null : toNumber(value);
}

/**
 * One grouped query for a whole page of course cards, not one per card.
 * Courses with no reviews are simply missing from the result — the caller
 * turns that absence into "no reviews yet".
 */
export async function findReviewAggregatesByCodes(
  codes: string[],
): Promise<ReviewAggregateRow[]> {
  if (codes.length === 0) return [];

  const rows = await db
    .select({
      courseCode: reviews.courseCode,
      reviewCount: count(),
      happyCount: sql<string>`count(*) filter (where ${reviews.happyTook})`,
      workloadMean: sql<string>`avg(${reviews.workloadScore})`,
      learningMean: sql<string>`avg(${reviews.learningScore})`,
      approachTheoryMean: sql<
        string | null
      >`avg(${reviews.approachTheoryPercent})`,
      approachTheoryAnswerCount: sql<string>`count(${reviews.approachTheoryPercent})`,
      examinationAnswerCount: sql<string>`count(${reviews.examinationDistribution})`,
      examMean: examinationShareMean("exam"),
      assignmentsMean: examinationShareMean("assignments"),
      labsMean: examinationShareMean("labs"),
      projectsMean: examinationShareMean("projects"),
      seminarsMean: examinationShareMean("seminars"),
      otherMean: examinationShareMean("other"),
    })
    .from(reviews)
    .where(inArray(reviews.courseCode, codes))
    .groupBy(reviews.courseCode);

  return rows.map((row) => ({
    courseCode: row.courseCode,
    reviewCount: toNumber(row.reviewCount),
    happyCount: toNumber(row.happyCount),
    workloadMean: toNumber(row.workloadMean),
    learningMean: toNumber(row.learningMean),
    approachTheoryMean: toNullableNumber(row.approachTheoryMean),
    approachTheoryAnswerCount: toNumber(row.approachTheoryAnswerCount),
    examinationAnswerCount: toNumber(row.examinationAnswerCount),
    examinationMeans:
      row.examMean === null
        ? null
        : {
            exam: toNumber(row.examMean),
            assignments: toNumber(row.assignmentsMean),
            labs: toNumber(row.labsMean),
            projects: toNumber(row.projectsMean),
            seminars: toNumber(row.seminarsMean),
            other: toNumber(row.otherMean),
          },
  }));
}

/**
 * How many app users have recorded taking each course, in one grouped query.
 * A course nobody has recorded is missing rather than zero-valued; the caller
 * supplies the zero, because here row existence *is* the count.
 */
export async function findTakenCountsByCodes(
  codes: string[],
): Promise<TakenCountRow[]> {
  if (codes.length === 0) return [];

  const rows = await db
    .select({
      courseCode: userTakenCourses.courseCode,
      takenCount: count(),
    })
    .from(userTakenCourses)
    .where(inArray(userTakenCourses.courseCode, codes))
    .groupBy(userTakenCourses.courseCode);

  return rows.map((row) => ({
    courseCode: row.courseCode,
    takenCount: toNumber(row.takenCount),
  }));
}

export async function findByCode(courseCode: string) {
  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.code, courseCode))
    .limit(1);
  return course;
}

export async function findByCodes(codes: string[]) {
  return db.select().from(courses).where(inArray(courses.code, codes));
}

export async function findRoundSummaries(courseCode: string) {
  return db
    .select({
      startTerm: courseRounds.startTerm,
      language: courseRounds.language,
    })
    .from(courseRounds)
    .where(eq(courseRounds.courseCode, courseCode));
}

export async function findExamCodes(courseCode: string) {
  return db
    .select({ examCode: courseExaminations.examCode })
    .from(courseExaminations)
    .where(eq(courseExaminations.courseCode, courseCode));
}

export async function findRoundSummariesByCodes(codes: string[]) {
  return db
    .select({
      courseCode: courseRounds.courseCode,
      startTerm: courseRounds.startTerm,
      language: courseRounds.language,
    })
    .from(courseRounds)
    .where(inArray(courseRounds.courseCode, codes));
}

export async function findExamCodesByCodes(codes: string[]) {
  return db
    .select({
      courseCode: courseExaminations.courseCode,
      examCode: courseExaminations.examCode,
    })
    .from(courseExaminations)
    .where(inArray(courseExaminations.courseCode, codes));
}

export async function findRoundDetails(courseCode: string) {
  return db
    .select({
      startTerm: courseRounds.startTerm,
      formattedPeriodsAndCredits: courseRounds.formattedPeriodsAndCredits,
      studyPace: courseRounds.studyPace,
      language: courseRounds.language,
      tutoringForm: courseRounds.tutoringForm,
      tutoringTimeOfDay: courseRounds.tutoringTimeOfDay,
      isPU: courseRounds.isPU,
      schemaUrl: courseRounds.schemaUrl,
    })
    .from(courseRounds)
    .where(eq(courseRounds.courseCode, courseCode));
}

export async function findExamDetails(courseCode: string) {
  return db
    .select({
      examCode: courseExaminations.examCode,
      title: courseExaminations.title,
      credits: courseExaminations.credits,
      gradeScaleCode: courseExaminations.gradeScaleCode,
    })
    .from(courseExaminations)
    .where(eq(courseExaminations.courseCode, courseCode));
}
