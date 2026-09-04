/**
 * Course card fixtures, extracted from the design.
 *
 * Source: `docs/design/Course Community - Course Card.dc.html` — the
 * `SAMPLE_GEO` / `SAMPLE_COURSE` literals in its trailing
 * `<script type="text/x-dc">` block, and that tag's `data-props` attribute,
 * which names `c: CourseCardModel` and `geo: CardGeometry`.
 *
 * **Regenerate from the artboard; do not hand-edit.** Values are copied
 * verbatim so a card built against this shape needs no reshaping when the real
 * aggregation lands. Nothing here is invented, renamed or tidied — including
 * the things that are plainly wrong (see "Known divergences" below).
 *
 * These are fixtures, not data. The card takes typed props and the *screen*
 * maps tRPC output onto them, so a server change touches one mapping function
 * rather than the card.
 *
 * ## Known divergences from the schema — do not "fix" them here
 *
 * - `workload: "3.8"` / `learning: "4.2"` are on the artboard's 1–5 scale.
 *   Scores are **1–10 displayed raw** (issue #68); a 7.6 renders `"7.6"` and
 *   the bar width is `value / 10`, which is the same width the artboard draws.
 * - `comparisons`, `hasComparisons` and `onNewComparison` are the design's word
 *   for **collections**. `CONTEXT.md` bans "comparison" in identifiers and #68
 *   settles the concept as Collection, so the card and everything downstream of
 *   it say `Collection`; these three field names are the one place that word
 *   survives, because #97 requires this file to quote the artboard verbatim.
 *   Every identifier this file coins itself — `CollectionPickerRow` — follows
 *   the glossary instead.
 * - `summary` is `courses.content` in the design's own store, so it does have a
 *   column behind it. `keywords` does not: the store reads a `searchTerms`
 *   field on `course_explore` that the table has no column for, and nothing in
 *   `server/` writes one. Until that is settled the card renders the header
 *   with an empty section (issue #68).
 * - `prereqCourses` entries carry `inCatalog` in the sample but the markup
 *   reads `taken`. Prerequisite ticks are display-only and never cascade.
 *
 * `apps/web/data/courseCardMockData.ts` is the older, unrelated mock that
 * existing components still use. This file does not replace it.
 */

/** One prerequisite chip. */
export interface PrerequisiteCourse {
  code: string;
  name: string;
  /** Whether the prerequisite is itself a course we hold. */
  inCatalog: boolean;
  /**
   * Whether the viewer has separately marked this course taken, which draws
   * the chip's checkmark. Display-only: marking a course taken never cascades
   * into its prerequisites (#68).
   *
   * The artboard markup reads this; the sample literal does not set it.
   */
  taken?: boolean;
  /**
   * Per-chip metrics the parent interpolates alongside `geo`, so the chips
   * shrink with the card. Markup-only, like `taken`.
   */
  gap?: string;
  padding?: string;
  radius?: string;
  bg?: string;
}

/**
 * One row of the collection picker.
 *
 * The artboard's own field is `c.comparisons`, kept verbatim below. This type
 * is not the artboard's, so it takes the glossary's word: `CONTEXT.md` bans
 * "comparison" in identifiers and #68 settles the concept as **Collection**.
 */
export interface CollectionPickerRow {
  name: string;
  /** SVG `fill` for the checkbox glyph. */
  fill: string;
  /** SVG `path` `d` for the checkbox tick. */
  tick: string;
  onClick?: () => void;
}

/**
 * The card's `c` prop. `data-props` types it `CourseCardModel`.
 *
 * Presentation is precomputed by the parent: the model carries strings and
 * booleans, not numbers to format or conditions to evaluate. `hasX` / `noX`
 * pairs are the artboard's two `sc-if` branches and are not complements —
 * both may be false while a third state renders.
 */
export interface CourseCardModel {
  title: string;
  /** Credits, department and level, already joined for display. */
  meta: string;
  /** Comma-separated; the card chips the first two and counts the rest. */
  keywords: string;
  /** Comma-separated prerequisite codes, already joined for display. */
  prereq: string;
  prereqCourses: PrerequisiteCourse[];
  hasPrereq: boolean;
  noPrereq: boolean;
  summary: string;
  /** The summary as the card shows it, clipped to `geo.summaryMax`. */
  summaryClipped: string;
  hasStats: boolean;
  noStats: boolean;
  /** Top examination contributors, e.g. `"Labs 60% · Exam 40%"`. */
  examLabel: string;
  /** Mean workload, preformatted. */
  workload: string;
  /** Mean learning, preformatted. */
  learning: string;
  /** Workload bar width, as a CSS percentage. */
  wlW: string;
  /** Learning bar width, as a CSS percentage. */
  leW: string;
  /** Share of reviewers glad they took the course, as a CSS percentage. */
  happyPct: string;
  hasReviewStats: boolean;
  noReviewStats: boolean;
  /** Taken count, abbreviated for display. */
  statTaken: string;
  /** Review count, as a string. */
  statReviews: string;

  // Per-instance presentation the parent resolves: colours that change with
  // card state, plus the taken pill's tooltip. Components style against the
  // `--cc-*` tokens; these fields exist because the artboard has no token for
  // a value that varies per card. Order is the artboard's, so the tooltip
  // sits among the colours.
  borderColor: string;
  takenTitle: string;
  takenCountFg: string;
  takenBg: string;
  takenFill: string;
  takenStroke: string;
  saveLabel: string;
  saveFg: string;
  saveBg: string;
  saveBorder: string;
  saveFill: string;

  pickerOpen: boolean;
  creating: boolean;
  notCreating: boolean;
  hasComparisons: boolean;
  comparisons: CollectionPickerRow[];

  // Referenced by the artboard markup but absent from the sample literal.
  /** Hover fill for the taken pill. */
  takenHoverBg?: string;
  /** Whether the guest sign-up prompt over the taken pill is open. */
  takenPickerOpen?: boolean;
  /** Accessible name for the picker trigger in the `"add"` action. */
  addLabel?: string;
  /** Accessible name and tooltip for the remove button. */
  removeLabel?: string;
  onOpen?: () => void;
  onTaken?: () => void;
  onReview?: () => void;
  onSave?: () => void;
  onPicker?: () => void;
  onNewComparison?: () => void;
  onRemove?: () => void;
  onSignUp?: () => void;
  onLogIn?: () => void;
}

/**
 * The card's `geo` prop. `data-props` types it `CardGeometry`.
 *
 * Geometry arrives as one object so the **parent** owns the collapse ramp:
 * Explore interpolates it from the results column width, Saved pins it to the
 * fully collapsed end. Every value is a CSS string the card drops straight
 * into a style, which is why widths and paddings are not numbers.
 */
export interface CardGeometry {
  /** CSS `transition` shorthand, or `"none"` while dragging the ramp. */
  tween: string;
  titleSize: string;
  cardGap: string;
  cardPad: string;
  factsGap: string;
  reviewPad: string;
  labelMax: string;
  labelOpacity: number;
  saveW: string;
  savePad: string;
  railW: string;
  railPad: string;
  summaryMax: string;
  summaryOpacity: number;
  reviewFlex: string;
  saveFlex: string;
  showLabel: boolean;
  cardHeight: string;
}

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
  hasComparisons: false,
  comparisons: [],
};
