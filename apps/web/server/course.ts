import type {
  CourseDetails,
  CourseRoundSummary,
  CourseSummary,
  ExamRoundSummary,
} from "@shared/types";
import { eq, inArray } from "drizzle-orm";
import type { Database } from "./db";
import {
  courseExaminations,
  courseRounds,
  courses,
  type SelectCourse,
} from "./db/schema";

export async function getCourse(
  db: Database,
  courseCode: string,
): Promise<SelectCourse | undefined> {
  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.code, courseCode))
    .limit(1);
  return course;
}

export async function getSummary(
  db: Database,
  courseCode: string,
): Promise<CourseSummary | null> {
  const [course, rounds, exams] = await Promise.all([
    getCourse(db, courseCode),
    db
      .select({
        startTerm: courseRounds.startTerm,
        language: courseRounds.language,
      })
      .from(courseRounds)
      .where(eq(courseRounds.courseCode, courseCode)),
    db
      .select({ examCode: courseExaminations.examCode })
      .from(courseExaminations)
      .where(eq(courseExaminations.courseCode, courseCode)),
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
  };
}

export async function getSummariesByCodes(
  db: Database,
  codes: string[],
): Promise<CourseSummary[]> {
  if (codes.length === 0) return [];

  const [courseRows, roundRows, examRows] = await Promise.all([
    db.select().from(courses).where(inArray(courses.code, codes)),
    db
      .select({
        courseCode: courseRounds.courseCode,
        startTerm: courseRounds.startTerm,
        language: courseRounds.language,
      })
      .from(courseRounds)
      .where(inArray(courseRounds.courseCode, codes)),
    db
      .select({
        courseCode: courseExaminations.courseCode,
        examCode: courseExaminations.examCode,
      })
      .from(courseExaminations)
      .where(inArray(courseExaminations.courseCode, codes)),
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
  db: Database,
  courseCode: string,
): Promise<CourseDetails | null> {
  const [course, rounds, exams] = await Promise.all([
    getCourse(db, courseCode),
    db
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
      .where(eq(courseRounds.courseCode, courseCode)),
    db
      .select({
        examCode: courseExaminations.examCode,
        title: courseExaminations.title,
        credits: courseExaminations.credits,
        gradeScaleCode: courseExaminations.gradeScaleCode,
      })
      .from(courseExaminations)
      .where(eq(courseExaminations.courseCode, courseCode)),
  ]);

  if (!course) return null;

  const mappedRounds: CourseRoundSummary[] = rounds.map((r) => ({
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
