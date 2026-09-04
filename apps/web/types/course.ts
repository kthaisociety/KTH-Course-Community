import type { ExaminationDistribution } from "./review";

/**
 * What the reviewers of one course said, aggregated.
 *
 * This shape only ever exists for a course that has at least one review:
 * "nobody has reviewed this" is `CourseStats.reviews === null`, never a
 * record of zeroes. A zero here always means a real measured zero.
 */
export interface CourseReviewStats {
  /** Reviews aggregated. Always at least 1. */
  reviewCount: number;
  /** Reviewers who said they are glad they took the course. */
  happyCount: number;
  /** `happyCount / reviewCount` as a whole percent. */
  happyPercent: number;
  /**
   * Mean workload score on the stored 1-10 scale, to one decimal. Workload is
   * not an overall verdict: a heavy course is not a bad one.
   */
  workloadMean: number;
  /** Mean learning score on the stored 1-10 scale, to one decimal. */
  learningMean: number;
  /**
   * Mean of the reviewers who remembered how theoretical the course was, as a
   * whole percent. `null` when nobody remembered — "I don't remember" is an
   * answer, and it is excluded from the mean rather than counted as 0%.
   */
  approachTheoryPercent: number | null;
  /** How many reviewers answered the theory/applied question. */
  approachTheoryAnswerCount: number;
  /**
   * Mean examination distribution over the reviewers who remembered one,
   * re-rounded to whole percentages that still add up to 100. `null` when
   * nobody remembered.
   */
  examinationDistribution: ExaminationDistribution | null;
  /** How many reviewers remembered an examination distribution. */
  examinationAnswerCount: number;
  /**
   * The top contributors of `examinationDistribution`, at most three, e.g.
   * `"Labs 60% · Exam 40%"`. `null` when nobody remembered.
   */
  examLabel: string | null;
}

/** The aggregate numbers a course card renders. */
export interface CourseStats {
  /** `null` when the course has no reviews: absent, not zero. */
  reviews: CourseReviewStats | null;
  /**
   * How many app users have recorded taking the course. Taken state is row
   * existence in `user_taken_courses`, so 0 is a true count rather than a
   * missing measurement.
   */
  takenCount: number;
}

// TODO: Enrich the types with review data, and consider user data types
// That is after we have implemented the review / user based systems.

/** Short summary for cards / previews. */
export interface CourseSummary {
  courseCode: string;
  titleEng: string;
  currentStatus: string;
  credits: number | null;
  creditUnit: string | null;
  department: string; // NOTE: Might consider replacing with dep code.
  startTerms: number[]; // all start terms across rounds, e.g. [20252, 20253]
  examTypes: string[] | null; // TODO: Currently just a placeholder. Want to process exam types for each course.
  languages: string[];
  updatedAt: string; // could be nice to display e.g. "course data updated 3 days ago"?
}

/** Full course description (detail views). */
export interface CourseDetails {
  courseCode: string;
  titleEng: string;
  titleSwe: string; // NOTE: Do we even want to display the swedish title?
  department: string; // TODO: Consider if we actually need both department and code.
  departmentCode: string;
  credits: number | null;
  creditUnit: string | null;
  educationalLevel: string | null; // E.g.
  gradeScale: string | null; // E.g. "AF" or "PF"
  goals: string | null;
  content: string | null;
  eligibility: string | null; // NOTE: raw text from KOPPS; may process later.
  rounds: CourseRoundSummary[];
  examinations: ExamRoundSummary[];
}

/** One offering of a course in a given term (e.g. DD2421 P2 vs P3). */
export interface CourseRoundSummary {
  startTerm: number; // e.g. 20252
  formattedPeriodsAndCredits: string | null; // e.g. "P1 (7,5 hp)"
  studyPace: number | null; // percentage, e.g. 50
  language: string | null; // "swedish" or "english" mainly.
  tutoringForm: string | null; // "NML" (Normal) or "DST" (Distance)
  tutoringTime: string | null; // "DAG" or "KVÄ".
  isProgrammeCourse: boolean; // if not programme course, open for anyone to register.
  schemaURL: string | null; // not sure how consistent this is in the API.
}

/** One examination component of a course (e.g. TEN1, LAB1). */
export interface ExamRoundSummary {
  examCode: string; // e.g. "TEN1"
  title: string | null; // e.g. "Tentamen"
  credits: number | null;
  gradeScaleCode: string | null; // "AF" or "PF"
}

/** A course summary carrying the aggregate numbers the card renders. */
export type CourseSummaryWithStats = CourseSummary & {
  stats: CourseStats;
};

/** Card-facing shape: summary plus per-user info derived client-side. */
export type CourseWithUserInfo = CourseSummary & {
  isUserFavorite: boolean;
};

/** Course search types. */
export interface SearchParams {
  query: string;
  page: number;
  pageSize: number;
  sort?: string;
  filters?: Record<string, string | string[]>;
}

export interface SearchResponse {
  results: CourseSummary[];
  total: number;
  page: number;
  pageSize: number;
  timings?: { tookMs: number };
}
