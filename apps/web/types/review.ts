/**
 * A reviewer's recollection of how assessment was split across a course, as
 * whole percentages that add up to 100. It is memory, not source data — see
 * `course_examinations` for what KOPPS reports. "I don't remember" is an
 * answer and is stored as `null`, never as a zero-filled distribution.
 */
export interface ExaminationDistribution {
  exam: number;
  assignments: number;
  labs: number;
  projects: number;
  seminars: number;
  other: number;
}

/** The keys of an examination distribution, in the order the form asks them. */
export const EXAMINATION_DISTRIBUTION_KEYS = [
  "exam",
  "assignments",
  "labs",
  "projects",
  "seminars",
  "other",
] as const satisfies readonly (keyof ExaminationDistribution)[];

/**
 * Display names for the distribution keys. The broad labels come from the
 * examination-method taxonomy in `docs/schema_docs/planned-database-formats.md`.
 */
export const EXAMINATION_DISTRIBUTION_LABELS: Record<
  keyof ExaminationDistribution,
  string
> = {
  exam: "Exam",
  assignments: "Assignments",
  labs: "Labs",
  projects: "Projects",
  seminars: "Seminars",
  other: "Other",
};

/** An app user's judgement that a review was or was not worth reading. */
export type ReviewVoteType = "up" | "down";

/** Review as exposed over the API (timestamps serialized as ISO strings). */
export interface Review {
  id: string;
  userId: string;
  courseCode: string;
  examinationDistribution: ExaminationDistribution | null;
  approachTheoryPercent: number | null;
  /** 1-10. */
  workloadScore: number;
  /** 1-10. */
  learningScore: number;
  happyTook: boolean;
  message: string | null;
  createdAt: string;
  updatedAt: string;
  upvoteCount: number;
  downvoteCount: number;
  userVote: ReviewVoteType | null;
}
