import type { Course } from "@/models/CourseModel";
import type { CourseDocument } from "../../types/search/elastic.mappings";

export async function checkIfCourseCodeExists(
  courseCode: string,
): Promise<boolean> {
  const backend = process.env.NEXT_PUBLIC_BACKEND_DOMAIN;
  if (!backend) throw new Error("NEXT_PUBLIC_BACKEND_DOMAIN is not set");

  const res = await fetch(
    `${backend}/course/neon/courseCodeExists/${courseCode}`,
    {
      cache: "no-store",
    },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = (await res.json()) as { exists: boolean };
  return data.exists;
}

// These 2 exports needs to be merged into one with the same type --> Course type from course_models.
// This one fetches from 'getCourse' from Search.controller, and the second one from 'Course.controller'.
// See ticket in Linear, needs refactoring.
export async function getCourseInfo(
  courseCode: string,
): Promise<CourseDocument> {
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

  const data = (await res.json()) as CourseDocument;

  if (!data) {
    throw new Error(`Course ${courseCode} data is empty`);
  }

  return data;
}

// This one uses the get course from 'course.controller', which stitches the
// object to be of type 'Course' (from course_models), without isUserFavorite.
// This is the one to keep, and the first one we should replace with this.
export async function getFullCourseInfo(courseCode: string): Promise<Course> {
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

  const data = (await res.json()) as Course;

  if (!data) {
    throw new Error(`Course ${courseCode} data is empty`);
  }

  return data;
}

// Should maybe bake this into the course object fetched from the backend.
// Is there any point in just fetching the credits without the course object?
export async function getCourseCredits(
  courseCode: string,
): Promise<number | null> {
  const backend = process.env.NEXT_PUBLIC_BACKEND_DOMAIN;
  if (!backend) throw new Error("NEXT_PUBLIC_BACKEND_DOMAIN is not set");

  const res = await fetch(
    `${backend}/course/neon/courseCredits/${courseCode}`,
    {
      cache: "no-store",
    },
  );

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = (await res.json()) as { credits: number | null };
  return data.credits;
}
