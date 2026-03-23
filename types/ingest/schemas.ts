import { z } from "zod";

// schema for each course from /api/kopps/v2/courses?l=en
export const CourseState = z.enum(["CANCELLED", "ESTABLISHED", "DEACTIVATED"]);
export const CourseSchema = z.object({
  department: z.string(),
  code: z.string(),
  name: z.string(),
  state: CourseState,
  last_examination_semester: z.string().optional(),
});
// validates an array of CoruseSchemas
export const CoursesSchema = z.array(CourseSchema);

// schema for /api/kopps/v2/course/:code/detailedinformation
export const CourseDetailSchema = z.object({
  // First part of the data is general course information.
  course: z.object({
    courseCode: z.string(),
    departmentCode: z.string(),
    department: z.object({ name: z.string() }),
    educationalLevelCode: z.string(),
    gradeScaleCode: z.string(),
    title: z.string(), // swedish title
    titleOther: z.string(), // english title
    credits: z.number(),
    creditUnitAbbr: z.string(),
    state: z.string(),
  }),
  // Second part of data from API is rounds, e.g. if course runs multiple offerings each year.
  roundInfos: z.array(
    z.object({
      schemaUrl: z.string().optional(),
      round: z.object({
        startTerm: z.object({ term: z.number() }),
        isPU: z.boolean(),
        isVU: z.boolean(),
        studyPace: z.number().optional(),
        tutoringTimeOfDay: z.object({ name: z.string() }).optional(),
        tutoringForm: z.object({ name: z.string() }).optional(),
        language: z.string().optional(),
        courseRoundTerms: z
          .array(
            z.object({ formattedPeriodsAndCredits: z.string().optional() }),
          )
          .optional(),
      }),
    }),
  ),
  // Third part of the course data from API is examinations, e.g. "TEN1".
  examinationSets: z.record(
    z.string(),
    z.object({
      examinationRounds: z.array(
        z.object({
          examCode: z.string(),
          title: z.string().optional(),
          gradeScaleCode: z.string(),
          credits: z.number(),
        }),
      ),
    }),
  ),
  // Fourth part of API data is the syllabus and course content
  publicSyllabusVersions: z.array(
    z.object({
      validFromTerm: z.object({ term: z.number() }),
      courseSyllabus: z.object({
        goals: z.string().default(""),
        content: z.string().default(""),
        eligibility: z.string().default(""), // NOTE: Will be used in later ingestions.
      }),
    }),
  ),
  mainSubjects: z.array(z.string()),
});

