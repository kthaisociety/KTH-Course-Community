import type { CourseDetails, CourseSummary } from "@shared/types";
import { nestHttpUrl } from "@/lib/nest-http";

export async function getCourseNames(
  codes: string[],
): Promise<Record<string, string>> {
  if (codes.length === 0) return {};
  const res = await fetch(
    nestHttpUrl(`/course/names?codes=${codes.join(",")}`),
    { cache: "no-store" },
  );
  if (!res.ok) return {};
  const data: { courseCode: string; titleEng: string }[] = await res.json();
  return Object.fromEntries(data.map((c) => [c.courseCode, c.titleEng]));
}

// For course cards (search results, favorited course etc). Minimal course info.
export async function getCourseSummary(
  courseCode: string,
): Promise<CourseSummary> {
  const res = await fetch(nestHttpUrl(`/course/${courseCode}`), {
    cache: "no-store", // TODO: Consider if we should store in cache.
  });

  if (res.status === 404) {
    throw new Error(`Course ${courseCode} not found in database.`);
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  return (await res.json()) as CourseSummary;
}

// This should return the full information when displaying "more info". For course page.
export async function getCourseDetails(
  courseCode: string,
): Promise<CourseDetails> {
  const res = await fetch(nestHttpUrl(`/course/${courseCode}/details`), {
    cache: "no-store",
  });

  if (res.status === 404) {
    throw new Error(`Course ${courseCode} not found`);
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const data = (await res.json()) as CourseDetails;

  if (!data) {
    throw new Error(`Course ${courseCode} data is empty.`);
  }
  return data;
}
