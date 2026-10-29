import { type Column, eq, inArray, or, type SQL, sql } from "drizzle-orm";
import { db } from "../db";
import { courseExaminations, courseRounds, courses } from "../db/schema";

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

/**
 * The SQL half of `courseNameKey` in `./name-key.ts`, applied to a catalogue
 * column. The two must stay step-for-step identical: lower-case, `&` and
 * ` och ` to ` and `, then strip everything outside `[a-z0-9]`. The class is
 * spelled as an explicit ASCII range rather than `[[:alnum:]]`, whose meaning
 * for non-ASCII letters depends on the database's collation.
 */
function nameKeySql(column: Column): SQL {
  return sql`regexp_replace(replace(replace(lower(${column}), '&', ' and '), ' och ', ' and '), '[^a-z0-9]+', '', 'g')`;
}

/**
 * The catalogue courses whose English or Swedish name has one of these
 * lookup keys, in one query. Read-only, and a prefilter only: the keys are
 * deliberately loose, and the caller re-checks every row it gets back.
 *
 * There is no index on either expression, so this scans `courses`; at the
 * catalogue's size that is one cheap query per transcript upload.
 */
export async function findByNameKeys(keys: string[]) {
  return db
    .select({
      courseCode: courses.code,
      titleEng: courses.titleEng,
      titleSwe: courses.titleSwe,
      credits: courses.credits,
    })
    .from(courses)
    .where(
      or(
        inArray(nameKeySql(courses.titleEng), keys),
        inArray(nameKeySql(courses.titleSwe), keys),
      ),
    );
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
      // The row's identity, and the only column that distinguishes two rounds
      // of one course in one term — see `CourseRoundSummary.id` and ADR 0004.
      id: courseRounds.id,
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
