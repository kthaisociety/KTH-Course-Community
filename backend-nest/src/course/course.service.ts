import { Inject, Injectable } from "@nestjs/common";
import { eq, inArray } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { DRIZZLE } from "../db/drizzle.module";
import * as schema from "../db/schema";
import {
  courseExaminations,
  courseRounds,
  courses,
  type SelectCourse,
} from "../db/schema";
import type {
  CourseDetails,
  CourseRoundSummary,
  CourseSummary,
  ExamRoundSummary,
} from "../types/course.types";

@Injectable()
export class CourseService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NeonHttpDatabase<typeof schema>,
  ) {}

  async getCourseNames(
    codes: string[],
  ): Promise<{ courseCode: string; titleEng: string }[]> {
    if (codes.length === 0) return [];
    const rows = await this.db
      .select({ code: courses.code, titleEng: courses.titleEng })
      .from(courses)
      .where(inArray(courses.code, codes));
    return rows.map((r) => ({ courseCode: r.code, titleEng: r.titleEng }));
  }

  // retrieves the basic course object (course table) based on course code
  async getCourse(courseCode: string): Promise<SelectCourse | undefined> {
    const [course] = await this.db
      .select()
      .from(courses)
      .where(eq(courses.code, courseCode))
      .limit(1);
    return course;
  }

  // constructs the summary course object by stitching from different tables
  async getSummary(courseCode: string): Promise<CourseSummary | null> {
    const [course, rounds, exams] = await Promise.all([
      this.getCourse(courseCode),
      this.db
        .select({
          startTerm: courseRounds.startTerm,
          language: courseRounds.language,
        })
        .from(courseRounds)
        .where(eq(courseRounds.courseCode, courseCode)),
      this.db
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

  // batched version of getSummary, used for search results.
  async getSummariesByCodes(codes: string[]): Promise<CourseSummary[]> {
    if (codes.length === 0) return [];

    const [courseRows, roundRows, examRows] = await Promise.all([
      this.db.select().from(courses).where(inArray(courses.code, codes)),
      this.db
        .select({
          courseCode: courseRounds.courseCode,
          startTerm: courseRounds.startTerm,
          language: courseRounds.language,
        })
        .from(courseRounds)
        .where(inArray(courseRounds.courseCode, codes)),
      this.db
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
        ...new Set(
          rounds.map((r) => r.language).filter((l): l is string => !!l),
        ),
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

  // constructs the details course object by stitching from different tables
  async getDetails(courseCode: string): Promise<CourseDetails | null> {
    const [course, rounds, exams] = await Promise.all([
      this.getCourse(courseCode),
      this.db
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
      this.db
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

    // constructs summaries of the CourseRounds table and the ExamRounds table
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
}
