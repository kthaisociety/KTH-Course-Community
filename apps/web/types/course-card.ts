/**
 * The course card's prop shape.
 *
 * Extracted from `docs/design_ref/2026-09-06/Course Community - Course Card.dc.html` — the
 * `data-props` attribute on its trailing `<script type="text/x-dc">` block names
 * `c: CourseCardModel` and `geo: CardGeometry`, and the markup below it is what
 * reads each field. `apps/web/data/course-card-sample.ts` carries the artboard's
 * own literals against these types.
 *
 * The card takes these props and the *screen* maps tRPC output onto them
 * (`features/courses/lib/course-card-model.ts`), so a server change touches one
 * mapping function rather than the card.
 *
 * ## Where these names differ from the artboard
 *
 * The artboard says `comparisons`, `hasComparisons` and `onNewComparison`, and
 * its buttons read "Add to comparison" / "Create new comparison". `CONTEXT.md`
 * bans "comparison" in identifiers and #68's settled decision 1 goes further:
 * there is no AI-comparison feature to name, so the word goes from the copy as
 * well. Identifier and label both say **Collection** (#90).
 */

/**
 * One prerequisite chip.
 *
 * Ticks are display-only: a chip shows a checkmark when the viewer has
 * separately marked *that* course taken. Marking a course taken never cascades
 * into its prerequisites — that would fabricate academic history, and
 * `CONTEXT.md` holds taken courses to be self-reported (#68).
 */
export interface PrerequisiteCourse {
  code: string;
  name: string;
  /** Whether the prerequisite is itself a course we hold. */
  inCatalog: boolean;
  /** Whether the viewer has marked this course taken, which draws the tick. */
  taken?: boolean;
  /**
   * Per-chip metrics the parent interpolates alongside `geo`, so the chips
   * shrink with the card.
   */
  gap?: string;
  padding?: string;
  radius?: string;
  bg?: string;
}

/** One row of the collection picker. */
export interface CollectionPickerRow {
  /** Identifies the collection this row writes to. */
  id: string;
  name: string;
  /** SVG `fill` for the checkbox glyph. */
  fill: string;
  /** SVG `path` `d` for the checkbox tick; empty when the course is not in it. */
  tick: string;
  onClick?: () => void;
}

/** Which action control the card shows: Explore's split Save, or Saved's picker. */
export type CourseCardAction = "save" | "add";

/**
 * The card's `c` prop.
 *
 * Presentation is precomputed by the parent: the model carries strings and
 * booleans, not numbers to format or conditions to evaluate. `hasX` / `noX`
 * pairs are the artboard's two `sc-if` branches and are **not complements** —
 * both may be false while a third state renders. That is how a course whose
 * prerequisites were never extracted stays distinct from one that genuinely has
 * none, and how a reviewed course with no remembered examination split stays
 * distinct from an unreviewed one (#68).
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
  /** Prerequisites were extracted and there is at least one. */
  hasPrereq: boolean;
  /** Prerequisites were extracted and there are none. */
  noPrereq: boolean;
  summary: string;
  /** The summary as the card shows it, clipped to `geo.summaryMax`. */
  summaryClipped: string;
  /** There are reviews and they remembered an examination split. */
  hasStats: boolean;
  /** There are no reviews at all. */
  noStats: boolean;
  /** Top examination contributors, e.g. `"Labs 60% · Exam 40%"`. */
  examLabel: string;
  /** Mean workload on the stored 1-10 scale, preformatted and unconverted. */
  workload: string;
  /** Mean learning on the stored 1-10 scale, preformatted and unconverted. */
  learning: string;
  /** Workload bar width, as a CSS percentage: the mean over 10. */
  wlW: string;
  /** Learning bar width, as a CSS percentage: the mean over 10. */
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
  // `--cc-*` tokens; these fields exist because the artboard has no token for a
  // value that varies per card, and the mapper fills them with `var(--cc-*)`.
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
  hasCollections: boolean;
  collections: CollectionPickerRow[];

  /** Hover fill for the taken pill. */
  takenHoverBg?: string;
  /** Whether the sign-up prompt over the taken pill is open. */
  takenPickerOpen?: boolean;
  /** Accessible name for the picker trigger in the `"add"` action. */
  addLabel?: string;
  /** Accessible name and tooltip for the remove button, which it also enables. */
  removeLabel?: string;
  onOpen?: () => void;
  onTaken?: () => void;
  /**
   * Optional here because this type is the artboard's prop shape and the
   * fixture built from its literals carries no handlers. The card draws the
   * button regardless, so `useCourseCard` requires one from every screen — see
   * `UseCourseCardOptions`.
   */
  onReview?: () => void;
  onSave?: () => void;
  onPicker?: () => void;
  onNewCollection?: () => void;
  onRemove?: () => void;
  onSignUp?: () => void;
  onLogIn?: () => void;
}

/**
 * The card's `geo` prop.
 *
 * Geometry arrives as one object so the **parent** owns the collapse ramp:
 * Explore interpolates it from the results column width, Saved pins it to one
 * end. Every value is a CSS string the card drops straight into a custom
 * property, which is why widths and paddings are not numbers — and why a
 * container query can still override one on a narrow card.
 *
 * `features/courses/lib/card-geometry.ts` builds these; nothing should write one
 * by hand.
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
