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
  course: z.object({
    courseCode: z.string(),
    departmentCode: z.string(),
    department: z.object({ name: z.string() }),
    educationalLevelCode: z.string(),
    gradeScaleCode: z.string(),
    title: z.string(),
    titleOther: z.string(),
    credits: z.number(),
    creditUnitAbbr: z.string(),
    state: z.string(),
  }),
  roundInfos: z.array(
    z.object({
      lectureCount: z.number().optional(),
      schemaUrl: z.string().optional(),
      isPU: z.boolean(),
      isVU: z.boolean(),
      startTerm: z.object({ term: z.number() }),
      startWeek: z.object({ year: z.number(), week: z.number() }).optional(),
      endWeek: z.object({ year: z.number(), week: z.number() }).optional(),
      studyPace: z.number().optional(),
      round: z.object({
        shortName: z.string().optional(),
        tutoringTimeOfDay: z.object({ name: z.string() }).optional(),
        tutoringForm: z.object({ name: z.string() }).optional(),
        language: z.string().optional(),
        courseRoundTerms: z
          .array(z.object({ formattedPeriodsAndCredits: z.string().optional() }))
          .optional(),
      }),
    }),
  ),
  examinationSets: z.record(
    z.string(),
    z.object({
      examinationRounds: z.array(
        z.object({
          examCode: z.string(),
          gradeScaleCode: z.string(),
          credits: z.number(),
        }),
      ),
    }),
  ),
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



// schema for course document in Elastic Search
export type Document = {
  course_name: string;
  course_code: string;
  department: string;
  state: "CANCELLED" | "ESTABLISHED" | "DEACTIVATED";
  goals: string;
  content: string;
  subject: string,
  periods: string[],  // e.g. ["P1 (7,5 hp)", "P3 (7,5 hp)"] — one per active round
  short_name: string,
  course_category: ("OPEN COURSE" | "PROGRAMME COURSE")[]; // can be both
};



export type InsertRequest = {
  index: {
    _index: string;
  };
  document: Document;
};

