import type {
  CourseDetails,
  CourseRoundSummary,
  CourseSummary,
  ExamRoundSummary,
} from "@/types";
import type { SelectCourse } from "../db/schema";
import * as courseRepo from "./repository";

export function getCourse(
  courseCode: string,
): Promise<SelectCourse | undefined> {
  return courseRepo.findByCode(courseCode);
}

export async function getSummary(
  courseCode: string,
): Promise<CourseSummary | null> {
  const [course, rounds, exams] = await Promise.all([
    courseRepo.findByCode(courseCode),
    courseRepo.findRoundSummaries(courseCode),
    courseRepo.findExamCodes(courseCode),
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
