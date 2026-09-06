import { decodeReviewDraft, type ReviewDraft } from "./review-draft";

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
 * `sessionStorage`, not `localStorage`, for the reason the workspace pane
 * still keeps its *open list* there (`features/workspace/lib/workspace-storage.ts`):
 * a half-finished queue belongs to the tab it was started in and has no business
 * still being there next week. Nothing kept here is data — an unsaved card has no
 * row — which is exactly why the browser is the right place for it.
 *
 * That file's *draft* is in `localStorage` instead, and the difference is worth
 * naming rather than copying by habit: the workspace sends a visitor out of the
 * tab to sign in, and the magic-link path lands them in a new one. Nothing here
 * does that. `/taken` opens to a signed-out visitor, but a round is dealt from
 * *taken* courses and a visitor has none — every card in this queue belongs to
 * an account that was already signed in when the round started, so the tab they
 * started in is the tab they finish in.
 *
 * Every read is defensive. What comes back is whatever was in the tab's
 * storage, possibly written by an older build, so anything that does not match
 * the shape is dropped rather than trusted — but at the granularity the thing
 * is worth at. A round that is not a round is refused whole; a *draft* is
 * salvaged field by field by the shared `decodeReviewDraft`, which is the one
 * decoder both storage surfaces go through so they cannot disagree about what a
 * bad draft means.
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

  /**
   * Each card's answers, salvaged rather than vetted.
   *
   * `decodeReviewDraft` drops a field it cannot read and keeps the rest. Do not
   * make it throw the whole card away instead: dropping a draft does not drop
   * the *card* — the code stays in `queue`, so the reviewer is dealt the same
   * course with an empty form and no sign that anything was lost — and
   * `reviewer.tsx` writes the whole session back in a `useEffect` keyed on
   * `round`, which fires on the mount that follows the restore, so the
   * discarded answers are gone from storage before the reviewer has typed
   * anything.
   *
   * The round-level refusals above are a different thing and they stay: a
   * missing or empty `queue` is genuinely not a round, and refusing one opens
   * no card and destroys no answers.
   */
  const drafts: Record<string, ReviewDraft> = {};
  if (isRecord(value.drafts)) {
    for (const [code, candidate] of Object.entries(value.drafts)) {
      const draft = decodeReviewDraft(candidate);
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
