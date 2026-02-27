import { z } from "zod";

export const CourseState = z.enum(["CANCELLED", "ESTABLISHED", "DEACTIVATED"]);
export const CourseSchema = z.object({
  department: z.string(),
  code: z.string(),
  name: z.string(),
  state: CourseState,
  last_examination_semester: z.string().optional(),
});
export const CoursesSchema = z.array(CourseSchema);

/** Schema for /api/kopps/v2/course/:code/detailedinformation */
export const CourseDetailSchema = z.object({
  course: z.object({
    credits: z.number(),
  }),
  publicSyllabusVersions: z.array(
    z.object({
      validFromTerm: z.object({ term: z.number() }),
      courseSyllabus: z.object({
        goals: z.string().default(""),
        content: z.string().default(""),
        eligibility: z.string().default(""),
      }),
    }),
  ),
});

export type Document = {
  course_name: string;
  course_code: string;
  department: string;
  state: "CANCELLED" | "ESTABLISHED" | "DEACTIVATED";
  goals: string;
  content: string;
};

export type InsertRequest = {
  index: {
    _index: string;
  };
  document: Document;
};
