import {
  EMPTY_REVIEW_DRAFT,
  type ExaminationKey,
  type ReviewDraft,
} from "./review-draft";

/**
 * What the fast-track reviewer keeps across a reload of `/taken`, and why.
 *
 * A card holds four answers and a line of prose, none of which has a row
 * anywhere until it is saved. Losing an eight-card queue to a stray refresh —
 * or to the browser reloading the tab on its own — throws away work the
 * reviewer cannot get back, and the queue is the one thing on this screen that
 * is not re-derivable from the server: which courses were skipped, and which
 * were already answered this round, exist nowhere else.
 *
 * `sessionStorage`, not `localStorage`, for the same reason the workspace pane
 * chose it (`features/workspace/lib/workspace-storage.ts`): a half-finished
 * queue belongs to the tab it was started in and has no business still being
 * there next week. Nothing kept here is data — an unsaved card has no row —
 * which is exactly why the browser is the right place for it.
 *
 * Every read is defensive. What comes back is whatever was in the tab's
 * storage, possibly written by an older build, so anything that does not match
 * the shape is dropped rather than trusted.
 *
 * **Being well-formed is not the same as being current.** Nothing in this file
 * knows which courses still need reviewing, so it cannot tell a round that was
 * interrupted a minute ago from one whose courses have since been reviewed in
 * the workspace pane. That check belongs to the screen that knows the
 * unreviewed set — `features/taken/components/taken-courses.tsx` waits for it
 * before it resumes anything, and drops any course the stored round has no
 * business dealing again. This file's job ends at "this parsed".
 */

const SESSION_KEY = "cc.taken.reviewer";

/** What happened to a card this round. A course not in the map is still to come. */
export type CardOutcome = "saved" | "skipped";

export interface ReviewerSession {
  /** The course codes queued when the reviewer opened, in order. */
  queue: string[];
  /** Cards already dealt with this round, by course code. */
  done: Record<string, CardOutcome>;
  /** Answers typed but not yet saved, by course code. */
  drafts: Record<string, ReviewDraft>;
}

const OUTCOMES: CardOutcome[] = ["saved", "skipped"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toDraft(value: unknown): ReviewDraft | null {
  if (!isRecord(value)) return null;

  const methods = Array.isArray(value.methods) ? value.methods : [];
  const shares = Array.isArray(value.shares) ? value.shares : [];
  if (
    !methods.every((method) => typeof method === "string") ||
    !shares.every((share) => typeof share === "number") ||
    methods.length !== shares.length
  ) {
    return null;
  }

  const score = (candidate: unknown) =>
    typeof candidate === "number" ? candidate : null;

  return {
    ...EMPTY_REVIEW_DRAFT,
    methods: methods as ExaminationKey[],
    shares,
    approachTheoryPercent: score(value.approachTheoryPercent),
    workloadScore: score(value.workloadScore),
    learningScore: score(value.learningScore),
    happyTook: typeof value.happyTook === "boolean" ? value.happyTook : null,
    message: typeof value.message === "string" ? value.message : "",
  };
}

/**
 * The reviewer session this tab left behind, or `null` if there is none worth
 * restoring.
 *
 * A session with an empty queue is not a session: it would reopen the reviewer
 * on a screen with no cards in it, which reads as a bug rather than as
 * continuity.
 */
export function readReviewerSession(): ReviewerSession | null {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || !Array.isArray(value.queue)) return null;

  /**
   * Deduplicated, because the round is a set of courses dealt in an order and
   * not a list that may repeat. Everything downstream keys progress by course
   * code — `done`, `drafts`, and the reviewer's own "which card is active" —
   * so a queue holding a code twice would draw two cards that one skip
   * finishes, count two skipped courses, and hand React two children with the
   * same key. There is no writer that can produce one; a tab's storage is not
   * a writer this file gets to trust.
   */
  const queue = [
    ...new Set(
      value.queue.filter((code): code is string => typeof code === "string"),
    ),
  ];
  if (queue.length === 0) return null;

  const done: Record<string, CardOutcome> = {};
  if (isRecord(value.done)) {
    for (const [code, outcome] of Object.entries(value.done)) {
      if (OUTCOMES.includes(outcome as CardOutcome)) {
        done[code] = outcome as CardOutcome;
      }
    }
  }

  const drafts: Record<string, ReviewDraft> = {};
  if (isRecord(value.drafts)) {
    for (const [code, candidate] of Object.entries(value.drafts)) {
      const draft = toDraft(candidate);
      if (draft) drafts[code] = draft;
    }
  }

  return { queue, done, drafts };
}

export function writeReviewerSession(session: ReviewerSession): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // A tab with storage disabled or full still runs the reviewer; it just
    // forgets the queue if the page is reloaded mid-round.
  }
}

/** Closing the reviewer ends the round, so nothing is left to come back to. */
export function clearReviewerSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
