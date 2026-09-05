/**
 * Course card fixtures, extracted from the design.
 *
 * Source: `docs/design_ref/2026-09-05/Course Community - Course Card.dc.html` — the
 * `SAMPLE_GEO` / `SAMPLE_COURSE` literals in its trailing
 * `<script type="text/x-dc">` block.
 *
 * **Regenerate the values from the artboard; do not hand-edit them.** They are
 * copied verbatim so a card built against this shape needs no reshaping when
 * the real aggregation lands. Nothing here is invented or tidied — including
 * the things that are plainly wrong (see "Known divergences" below).
 *
 * The types moved to `@/types/course-card`, which is where the card, the mapper
 * and every screen read them from; this file is only the artboard's literals.
 *
 * These are fixtures, not data. The card takes typed props and the *screen*
 * maps tRPC output onto them via
 * `features/courses/lib/course-card-model.ts`, so a server change touches one
 * mapping function rather than the card.
 *
 * ## Known divergences from the schema — do not "fix" them here
 *
 * - `workload: "3.8"` / `learning: "4.2"` are on the artboard's 1-5 scale.
 *   Scores are **1-10 displayed raw** (#68); a 7.6 renders `"7.6"` and the bar
 *   width is `value / 10`, which is the same width the artboard draws. The
 *   mapper does that; these literals predate the scale decision.
 * - `"1.2k students have taken this course"` is real KTH enrolment in the
 *   design's mock store. The schema only knows `user_taken_courses` — app users
 *   who marked the course themselves — so the mapper says **members**, not
 *   students (#68). The number is real; the artboard's sentence was not.
 * - `keywords` and `summary` render empty. `course_explore` has no
 *   `search_terms` column, and the summary maps to `courses.content`, which is
 *   KOPPS syllabus prose — long, boilerplate-heavy and near-identical across
 *   courses, so clipping it into a card slot would put the same opening line on
 *   every card in a grid. #73 generates the real blurb.
 * - `prereqCourses` entries carry `inCatalog` in the sample but the markup reads
 *   `taken`. Prerequisite ticks are display-only and never cascade (#68).
 * - The artboard's `comparisons` / `hasComparisons` / `onNewComparison` are its
 *   word for **collections**. `CONTEXT.md` bans "comparison" in identifiers and
 *   #68 settles the concept as Collection, so they are renamed here and
 *   everywhere downstream. Reader-facing copy still follows the design.
 *
 * This is a design/test fixture only. Live screens map tRPC output through
 * `features/courses/lib/course-card-model.ts`; this sample is never imported
 * by a shipped screen.
 */

import type { CardGeometry, CourseCardModel } from "@/types";

/** The fully expanded end of the collapse ramp. */
export const SAMPLE_GEO: CardGeometry = {
  tween: "none",
  titleSize: "17px",
  cardGap: "10px",
  cardPad: "18px",
  factsGap: "14px",
  reviewPad: "0 12px",
  labelMax: "120px",
  labelOpacity: 1,
  saveW: "126px",
  savePad: "12px",
  railW: "224px",
  railPad: "18px 16px",
  summaryMax: "38px",
  summaryOpacity: 1,
  reviewFlex: "0 1 132px",
  saveFlex: "0 1 158px",
  showLabel: true,
  cardHeight: "236px",
};

/**
 * Stand-in course used only when the artboard is opened on its own, so the
 * preview matches what Explore and Saved courses render.
 */
export const SAMPLE_COURSE: CourseCardModel = {
  title: "DD2380 Artificial Intelligence",
  meta: "6.0 credits · EECS · Advanced",
  keywords: "search, planning, probabilistic reasoning, agents",
  prereq: "DD1337, SF1918",
  prereqCourses: [
    { code: "DD1337", name: "Programming", inCatalog: true },
    { code: "SF1918", name: "Probability and Statistics", inCatalog: true },
  ],
  hasPrereq: true,
  noPrereq: false,
  summary:
    "A broad first course in AI: search, planning and reasoning under uncertainty, taught through three programming labs.",
  summaryClipped:
    "A broad first course in AI: search, planning and reasoning under uncertainty, taught through three programming labs.",
  hasStats: true,
  noStats: false,
  examLabel: "Labs 60% · Exam 40%",
  workload: "3.8",
  learning: "4.2",
  wlW: "76%",
  leW: "84%",
  happyPct: "87%",
  hasReviewStats: true,
  noReviewStats: false,
  statTaken: "1.2k",
  statReviews: "148",
  borderColor: "#e5e0d2",
  takenTitle: "1.2k students have taken this course · click to mark as taken",
  takenCountFg: "#5c6570",
  takenBg: "transparent",
  takenFill: "none",
  takenStroke: "#8a857a",
  saveLabel: "Save course",
  saveFg: "#1751a6",
  saveBg: "#fff",
  saveBorder: "#ddd8c9",
  saveFill: "none",
  pickerOpen: false,
  creating: false,
  notCreating: true,
  hasCollections: false,
  collections: [],
};
