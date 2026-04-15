import type { CourseDetails, CourseSummary } from "@shared/types";

const backend = process.env.NEXT_PUBLIC_BACKEND_DOMAIN;

// For course cards (search results, favorited course etc). Minimal course info.
export async function getCourseSummary(
  courseCode: string,
): Promise<CourseSummary> {
  if (!backend) throw new Error("NEXT_PUBLIC_BACKEND_DOMAIN is not set");

  const res = await fetch(`${backend}/course/${courseCode}`, {
    cache: "no-store", // TODO: Consider if we should store in cache.
  });

  if (res.status === 404) {
    throw new Error(`Course ${courseCode} not found in database (NEON)`);
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
  const backend = process.env.NEXT_PUBLIC_BACKEND_DOMAIN;
  if (!backend) throw new Error("NEXT_PUBLIC_BACKEND_DOMAIN is not set");

  const res = await fetch(`${backend}/course/${courseCode}`, {
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
    throw new Error(`Course ${courseCode} data is empty`);
  }
  return data;
}
