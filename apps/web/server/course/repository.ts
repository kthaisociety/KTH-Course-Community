import { eq, inArray } from "drizzle-orm";
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
