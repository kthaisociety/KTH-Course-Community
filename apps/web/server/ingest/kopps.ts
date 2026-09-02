import type { z } from "zod";
import {
  CourseDetailSchema,
  type CourseSchema,
  CoursesSchema,
} from "./schemas";

export async function getCourses() {
  const endpoint = "https://api.kth.se/api/kopps/v2/courses?l=en";
  const res = await fetch(endpoint);
  if (!res.ok) throw new Error(`KOPPS courses HTTP ${res.status}`);
  const data = await res.json();
  return CoursesSchema.parse(data);
}

export async function getCourseInformation(
  course: z.infer<typeof CourseSchema>,
) {
  const endpoint = `https://api.kth.se/api/kopps/v2/course/${course.code}/detailedinformation`;
  await new Promise((r) => setTimeout(r, 200));
  const res = await fetch(endpoint);
  if (!res.ok) throw new Error(`KOPPS detail HTTP ${res.status}`);
  const data = await res.json();
  return CourseDetailSchema.parse(data);
}
