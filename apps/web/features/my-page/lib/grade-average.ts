/**
 * The credit-weighted average My Page shows on its Overview tab.
 *
 * Grades are self-reported: `user_taken_courses.grade` is free text a
 * transcript import or a manual edit wrote, so nothing here may assume a
 * closed set. Anything that is not an A-E letter — `P`, `F`, a blank, a scale
 * this build has never seen — is left out of both the numerator and the
 * denominator rather than scored as a zero. Scoring an unknown grade would
 * invent an academic fact about a real person.
 *
 * The points and the weighting are the design's own, from `gpaFor` in
 * `docs/design_ref_new/cc-store.js`.
 */

/** Points per grade on KTH's A-F scale. `F` is absent deliberately — see below. */
export const GRADE_POINTS: Readonly<Record<string, number>> = {
  A: 5,
  B: 4,
  C: 3,
  D: 2,
  E: 1,
};

/** The subset of a taken course this calculation reads. */
export type GradedCourse = {
  grade: string | null;
  earnedCredits: number | null;
};

export type GradeAverage = {
  /** `null` when no course carries both an A-E grade and credits. */
  average: number | null;
  /** How many credits the average is worked out over. */
  gradedCredits: number;
  /** Whether any taken course has a grade stored at all, of any kind. */
  hasStoredGrades: boolean;
};

/**
 * The credit-weighted average over A-E graded courses.
 *
 * `F` is excluded along with every other non-A-E grade. A failed course earns
 * no credits, so it carries no weight either way, and the alternative —
 * treating it as a zero-point course with whatever credits someone typed —
 * would make one mistyped row swing an average that is nobody else's business.
 */
export function creditWeightedAverage(
  courses: readonly GradedCourse[],
): GradeAverage {
  let points = 0;
  let gradedCredits = 0;
  let hasStoredGrades = false;

  for (const course of courses) {
    if (course.grade !== null && course.grade.trim() !== "") {
      hasStoredGrades = true;
    }

    const scored = GRADE_POINTS[normalizeGrade(course.grade)];
    if (scored === undefined) continue;

    const credits = course.earnedCredits ?? 0;
    gradedCredits += credits;
    points += scored * credits;
  }

  return {
    average: gradedCredits > 0 ? points / gradedCredits : null,
    gradedCredits,
    hasStoredGrades,
  };
}

/** Total credits earned, over every taken course that recorded any. */
export function totalEarnedCredits(courses: readonly GradedCourse[]): number {
  return courses.reduce(
    (total, course) => total + (course.earnedCredits ?? 0),
    0,
  );
}

function normalizeGrade(grade: string | null): string {
  return grade === null ? "" : grade.trim().toUpperCase();
}
