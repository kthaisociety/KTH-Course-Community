import * as savedRepo from "./repository";

/**
 * Saved state is the existence of a row, never a flag, so both writes report
 * the state the caller ended in rather than a toggle result.
 */
export type SavedCourseState = { courseCode: string; saved: boolean };

export function listSavedCourseCodes(userId: string): Promise<string[]> {
  return savedRepo.listSavedCourseCodes(userId);
}

export async function isCourseSaved(
  userId: string,
  courseCode: string,
): Promise<boolean> {
  return (await savedRepo.findSavedCourse(userId, courseCode)) !== undefined;
}

/** Idempotent: saving a course already saved succeeds and changes nothing. */
export async function saveCourse(
  userId: string,
  courseCode: string,
): Promise<SavedCourseState> {
  await savedRepo.insertSavedCourse(userId, courseCode);
  return { courseCode, saved: true };
}

/**
 * Idempotent: unsaving a course that is not saved succeeds.
 *
 * Saving, taking and reviewing are independent relationships, so this removes
 * the saved row and nothing else — taken history and reviews survive.
 */
export async function unsaveCourse(
  userId: string,
  courseCode: string,
): Promise<SavedCourseState> {
  await savedRepo.deleteSavedCourse(userId, courseCode);
  return { courseCode, saved: false };
}
