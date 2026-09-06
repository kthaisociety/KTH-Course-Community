/**
 * The one place tRPC output becomes what the course card renders.
 *
 * Every screen that shows a card — Explore, Saved, Collections — maps through
 * here, so when the aggregation behind `course.stats` changes, one function
 * changes and no card does. Nothing in this file touches React or the network:
 * it is pure, which is why it is tested in the `logic` project rather than
 * through a render.
 *
 * ## The rules it exists to keep
 *
 * - **Absent is not zero.** `stats.reviews === null` means nobody has reviewed
 *   the course. It renders "No reviews yet", never 0% happy. `reviews` is empty
 *   today, so this is the common case rather than an edge one.
 * - **Scores are 1-10, shown raw.** A 7.6 mean renders `"7.6"` and fills 76% of
 *   its bar. Nothing converts to a five-point scale (#68).
 * - **`hasX` / `noX` are not complements.** Both false is a real third state:
 *   prerequisites nobody ever extracted, or a reviewed course whose reviewers
 *   did not remember the examination split.
 */

import type {
  CollectionPickerRow,
  CourseCardModel,
  CourseStats,
  PrerequisiteCourse,
} from "@/types";

/** Chips shown before the row overflows into a `+n` counter. */
const KEYWORD_CHIPS_SHOWN = 2;

/** Counts at or above this are abbreviated to thousands. */
const ABBREVIATE_FROM = 1000;

/** Above this many thousands the decimal stops earning its place. */
const DECIMAL_K_BELOW = 10_000;

/**
 * What a card renders while `course.stats` is still in flight, and for a code
 * the batch did not answer for.
 *
 * `reviews: null` is the truthful half: it renders "No reviews yet" rather than
 * 0% happy. `takenCount: 0` is not — the count is unknown, not zero — but
 * `CourseStats` has no "unknown" for it and the pill has no unknown state to
 * draw. It settles to the real figure the moment the batch answers, and 0 is
 * what `user_taken_courses` holds for very nearly every course today.
 */
export const NO_COURSE_STATS: CourseStats = { reviews: null, takenCount: 0 };

/** The course facts the card names in its title and its meta line. */
export type CourseCardCourse = {
  courseCode: string;
  titleEng: string;
  credits: number | null;
  department: string | null;
  /** KOPPS's level word, e.g. `"Advanced"`. Only `course.details` carries it. */
  educationalLevel?: string | null;
};

/** Everything the card's display half is derived from. */
export type CourseCardView = {
  course: CourseCardCourse;
  stats: CourseStats;
  /** Whether the viewer has saved this course. */
  isSaved: boolean;
  /** Whether the viewer has marked this course taken. */
  isTaken: boolean;
  /**
   * `null` means prerequisites were never extracted, which is every course
   * today: `course_prerequisites` is a real table that nothing in `server/`
   * writes. `[]` means they were extracted and the course genuinely has none.
   * The two render differently, because "None listed" over an empty table
   * asserts something false (#68).
   */
  prerequisites?: PrerequisiteCourse[] | null;
  /** The picker's rows, already bound to their collections. */
  collections?: CollectionPickerRow[];
  /** Explore rings the card whose workspace pane is open. */
  isActive?: boolean;
  pickerOpen?: boolean;
  creating?: boolean;
  takenPickerOpen?: boolean;
  /** Enables the remove button, and names it. Collections and Saved pass one. */
  removeLabel?: string;
};

/**
 * The keyword row is exactly one 20px line, so a second row would be clipped
 * through the middle of its glyphs. Two chips fit; whatever else there is gets
 * counted instead of half-drawn.
 */
export function keywordChips(
  raw: string,
): Array<{ label: string; flex: string }> {
  const all = raw
    .split(",")
    .map((term) => term.trim())
    .filter(Boolean);

  const shown = all
    .slice(0, KEYWORD_CHIPS_SHOWN)
    .map((label) => ({ label, flex: "0 1 auto" }));

  if (all.length > KEYWORD_CHIPS_SHOWN) {
    shown.push({
      label: `+${all.length - KEYWORD_CHIPS_SHOWN}`,
      flex: "none",
    });
  }
  return shown;
}

/**
 * Counts as the 26px taken pill can hold them: `"940"`, `"1.2k"`, `"24k"`.
 */
export function formatCount(count: number): string {
  if (count < ABBREVIATE_FROM) return String(count);
  if (count < DECIMAL_K_BELOW) {
    return `${(Math.round(count / 100) / 10).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return `${Math.round(count / 1000)}k`;
}

/** `"6.0 credits · EECS · Advanced"`, minus whatever the course does not have. */
export function formatCourseMeta(course: CourseCardCourse): string {
  return [
    course.credits === null ? null : `${course.credits.toFixed(1)} credits`,
    course.department,
    course.educationalLevel,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}

/**
 * A 1-10 mean as a bar width. 7.6 fills 76%, which is the width the artboard
 * draws for the same bar — the scale changed, the geometry did not.
 */
function barWidth(mean: number): string {
  const percent = Math.min(100, Math.max(0, Math.round(mean * 100) / 10));
  return `${percent}%`;
}

/**
 * The taken pill's tooltip.
 *
 * The artboard says "students", sourced from real KTH enrolment in the design's
 * mock store. The schema has no such figure: `user_taken_courses` counts app
 * users who marked the course themselves, a smaller and different population.
 * The number is real, the sentence was not, so the copy is what changed (#68).
 */
function takenTitle(takenCount: number, isTaken: boolean): string {
  const suffix = isTaken ? "you marked it as taken" : "click to mark as taken";

  if (takenCount === 0) {
    return `No members have marked this course as taken · ${suffix}`;
  }
  const members =
    takenCount === 1
      ? "1 member has taken this course"
      : `${formatCount(takenCount)} members have taken this course`;
  return `${members} · ${suffix}`;
}

/**
 * Chip metrics for one prerequisite. A course the viewer has taken gets the
 * pill treatment; the tick itself is drawn by the card from `taken`.
 */
function toPrerequisiteChip(
  prerequisite: PrerequisiteCourse,
): PrerequisiteCourse {
  return {
    ...prerequisite,
    bg: prerequisite.taken ? "var(--cc-info)" : "transparent",
    radius: prerequisite.taken ? "999px" : "6px",
    padding: "0 8px 0 5px",
    gap: "5px",
  };
}

/**
 * Maps one course, its aggregates and the viewer's relationship to it onto the
 * card's display fields.
 *
 * Handlers and the picker's transient state are the caller's to add — see
 * `useCourseCard`, which spreads them over this result. Splitting it that way
 * keeps everything derived from data testable without a DOM.
 */
export function toCourseCardModel(view: CourseCardView): CourseCardModel {
  const { course, stats } = view;
  const reviews = stats.reviews;
  const prerequisites = view.prerequisites ?? null;
  const collections = view.collections ?? [];
  const creating = view.creating ?? false;

  return {
    title: `${course.courseCode} ${course.titleEng}`,
    meta: formatCourseMeta(course),

    // `course_explore` has no `search_terms` column and nothing writes one, so
    // the header renders over an empty row until #73 seeds keywords.
    keywords: "",

    prereq: prerequisites ? prerequisites.map((p) => p.code).join(", ") : "",
    prereqCourses: prerequisites ? prerequisites.map(toPrerequisiteChip) : [],
    hasPrereq: prerequisites !== null && prerequisites.length > 0,
    noPrereq: prerequisites !== null && prerequisites.length === 0,

    // `courses.content` exists, but it is KOPPS syllabus prose: long,
    // boilerplate-heavy and near-identical across courses, so clipping it here
    // would print the same opening line on every card in a grid. #73 writes the
    // blurb that belongs in this slot.
    summary: "",
    summaryClipped: "",

    hasStats: reviews !== null && reviews.examLabel !== null,
    noStats: reviews === null,
    examLabel: reviews?.examLabel ?? "",

    workload: reviews ? reviews.workloadMean.toFixed(1) : "—",
    learning: reviews ? reviews.learningMean.toFixed(1) : "—",
    wlW: reviews ? barWidth(reviews.workloadMean) : "0%",
    leW: reviews ? barWidth(reviews.learningMean) : "0%",
    happyPct: reviews ? `${reviews.happyPercent}%` : "—",
    hasReviewStats: reviews !== null,
    noReviewStats: reviews === null,

    statTaken: formatCount(stats.takenCount),
    statReviews: String(reviews?.reviewCount ?? 0),

    borderColor: view.isActive ? "var(--cc-brand)" : "var(--cc-rule2)",
    takenTitle: takenTitle(stats.takenCount, view.isTaken),
    takenCountFg: view.isTaken ? "var(--cc-brand)" : "var(--cc-muted)",
    takenBg: view.isTaken ? "var(--cc-info)" : "transparent",
    takenHoverBg: "var(--cc-pill)",
    takenFill: "none",
    takenStroke: "currentColor",

    saveLabel: view.isSaved ? "Saved" : "Save course",
    saveFg: view.isSaved ? "var(--cc-brand)" : "var(--cc-chip-ink)",
    saveBg: view.isSaved ? "var(--cc-info)" : "transparent",
    saveBorder: view.isSaved ? "var(--cc-brand)" : "var(--cc-rule3)",
    saveFill: "none",

    pickerOpen: view.pickerOpen ?? false,
    creating,
    hasCollections: collections.length > 0,
    collections,

    takenPickerOpen: view.takenPickerOpen ?? false,
    // The artboards read "Add to comparison", and #68's settled decision 1
    // overrides them: there is no AI-comparison feature, so promising one in
    // the words a reader sees is the same error as promising it in an
    // identifier. The panel this button opens is already headed "Add to
    // collections", and the two disagreeing was the confusion #68 settled. The
    // card renders this string *and* uses it as the accessible name, so those
    // two cannot drift apart either.
    addLabel: "Add to collection",
    removeLabel: view.removeLabel,
  };
}
