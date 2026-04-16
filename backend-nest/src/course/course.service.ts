import { Inject, Injectable } from "@nestjs/common";
import type {
  CourseDetails,
  CourseRoundSummary,
  CourseSummary,
  ExamRoundSummary,
} from "@shared/types";
import { eq } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { DRIZZLE } from "../db/drizzle.module";
import * as schema from "../db/schema";
import {
  courseExaminations,
  courseRounds,
  courses,
  type SelectCourse,
} from "../db/schema";

@Injectable()
export class CourseService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NeonHttpDatabase<typeof schema>,
  ) {}

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
