import { z } from "zod";

/** The keys of an examination distribution, in the order the form asks them. */
export const EXAMINATION_DISTRIBUTION_KEYS = [
  "exam",
  "assignments",
  "labs",
  "projects",
  "seminars",
  "other",
] as const;

/**
 * Display names for the distribution keys. The broad labels come from the
 * examination-method taxonomy in `docs/schema_docs/planned-database-formats.md`.
 */
export const EXAMINATION_DISTRIBUTION_LABELS: Record<
  (typeof EXAMINATION_DISTRIBUTION_KEYS)[number],
  string
> = {
  exam: "Exam",
  assignments: "Assignments",
  labs: "Labs",
  projects: "Projects",
  seminars: "Seminars",
  other: "Other",
};

/**
 * Both review score axes are 1-10. The range governs the database check
 * constraints and service validation alike — see
 * `docs/schema_docs/planned-database-formats.md`.
 */
export const MIN_REVIEW_SCORE = 1;
export const MAX_REVIEW_SCORE = 10;

export const reviewScoreSchema = z
  .number()
  .int()
  .min(MIN_REVIEW_SCORE)
  .max(MAX_REVIEW_SCORE);

export const percentSchema = z.number().int().min(0).max(100);

/**
 * A reviewer's recollection of how assessment was split across a course, as
 * whole percentages that add up to 100. It is memory, not source data — see
 * `course_examinations` for what KOPPS reports. "I don't remember" is an
 * answer and is stored as `null`, never as a zero-filled distribution.
 */
export const examinationDistributionSchema = z
  .object({
    exam: percentSchema,
    assignments: percentSchema,
    labs: percentSchema,
    projects: percentSchema,
    seminars: percentSchema,
    other: percentSchema,
  })
  .refine(
    (value) =>
      EXAMINATION_DISTRIBUTION_KEYS.reduce(
        (total, key) => total + value[key],
        0,
      ) === 100,
    "Examination shares must add up to 100%.",
  );

export type ExaminationDistribution = z.infer<
  typeof examinationDistributionSchema
>;

/** The reviewer-supplied half of a review; the rest is identity and clock. */
export const reviewInputSchema = z.object({
  /** `null` is the stored answer for "I don't remember". */
  examinationDistribution: examinationDistributionSchema.nullable(),
  /** `null` is the stored answer for "I don't remember". */
  approachTheoryPercent: percentSchema.nullable(),
  workloadScore: reviewScoreSchema,
  learningScore: reviewScoreSchema,
  happyTook: z.boolean(),
  /** `null` when the reviewer wrote nothing, never an empty string. */
  message: z.string().nullable(),
});

export type ReviewInput = z.infer<typeof reviewInputSchema>;

/** An app user's judgement that a review was or was not worth reading. */
export const reviewVoteTypeSchema = z.enum(["up", "down"]);

export type ReviewVoteType = z.infer<typeof reviewVoteTypeSchema>;

/** Review as exposed over the API (timestamps serialized as ISO strings). */
export interface Review extends ReviewInput {
  id: string;
  userId: string;
  courseCode: string;
  createdAt: string;
  updatedAt: string;
  upvoteCount: number;
  downvoteCount: number;
  userVote: ReviewVoteType | null;
}
