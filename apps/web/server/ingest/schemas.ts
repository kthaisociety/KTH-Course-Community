import { z } from "zod";

// The shapes below were KOPPS's; `kth-web.ts` now produces them from kth.se.

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
    state: CourseState,
  }),
  // Start terms the source reported rounds for, cancelled ones included. Ingest
  // replaces rounds for these terms only, so rounds for terms the source no
  // longer lists (the KOPPS history, ADR 0012) are kept.
  coveredRoundTerms: z.array(z.number()).default([]),
  // Second part of data from API is rounds, e.g. if course runs multiple offerings each year.
  roundInfos: z.array(
    z.object({
      schemaUrl: z.string().optional(),
      round: z.object({
        startTerm: z.object({ term: z.number() }),
        isPU: z.boolean(),
        isVU: z.boolean(),
        studyPace: z.number().int().min(1).max(100).optional(),
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
          credits: z.number().optional(),
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

// ---- kth.se course pages (window.__compressedData__DATA), read by kth-web.ts ----
// Only the fields ingest maps. Everything is optional because KTH omits fields
// freely; a field that is present but of the wrong type fails the parse.

const PageTerm = z.object({ year: z.number(), semesterNumber: z.number() });
const optionalText = z.string().nullish();

export const PageSyllabusSchema = z.object({
  course_goals: optionalText,
  course_content: optionalText,
  course_eligibility: optionalText,
  course_examination: optionalText,
  course_valid_from: PageTerm.nullish(),
});

export const PageRoundSchema = z.object({
  round_course_term: z.tuple([z.number(), z.number()]).nullish(),
  // A number, or the "no information" placeholder (FAK3132), which is no pace.
  round_study_pace: z
    .union([z.number(), z.string(), z.null()])
    .transform((v) => (typeof v === "number" ? v : undefined))
    .optional(),
  round_schedule: optionalText,
  round_tutoring_language: optionalText,
  round_tutoring_form: optionalText,
  round_tutoring_time: optionalText,
  round_periods: optionalText,
  round_part_of_programme: optionalText,
  show_application_link: z.boolean().nullish(),
  round_is_cancelled: z.boolean().nullish(),
});

export const CoursePageSchema = z.object({
  courseInfo: z.object({
    course_code: z.string().min(1),
    course_title: z.string(),
    course_credits_label: optionalText,
    course_department: optionalText,
    course_department_code: optionalText,
    course_level_code: optionalText,
    course_grade_scale: optionalText,
    course_main_subject: optionalText,
    course_is_discontinued: z.boolean().nullish(),
  }),
  syllabusList: z
    .array(PageSyllabusSchema)
    .nullish()
    .transform((v) => v ?? []),
  roundsBySemester: z
    .record(z.string(), z.array(PageRoundSchema))
    .nullish()
    .transform((v) => v ?? {}),
});

// /student/kurser/intern-api/sok/:lang
export const CourseSearchResponseSchema = z.object({
  searchData: z
    .object({
      results: z
        .array(z.object({ kod: z.string(), benamning: z.string() }))
        .default([]),
    })
    .optional(),
  errorCode: z.string().optional(),
});
