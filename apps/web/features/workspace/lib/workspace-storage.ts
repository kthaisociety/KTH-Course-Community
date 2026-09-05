import type { ExaminationKey } from "@/features/reviews/lib/review-draft";
import { EXAMINATION_DISTRIBUTION_KEYS } from "@/types";
import {
  EMPTY_WORKSPACE,
  type OpenCourse,
  type OpenCourseKind,
  type Workspace,
} from "./open-courses";
import {
  EMPTY_REVIEW_DRAFT,
  isUntouched,
  type ReviewDraft,
} from "./review-draft";

/**
 * What the workspace keeps across a page load, and why it has to.
 *
 * Signing in is a redirect: the page navigates away and comes back, and
 * everything in React state goes with it. `AuthReasonDialog` promises the
 * opposite — "Your draft is held as it is — text, ratings and the course all
 * stay put" — and the artboard says the same in its own words. Keeping that
 * promise is the whole reason this file exists.
 *
 * ## Two storages, because the two things have different lifetimes
 *
 * The open list, what this workspace published, and the note that it is waiting
 * on a sign-in are all in `sessionStorage`: an open workspace belongs to the tab
 * the student is working in, and it should not still be there next week. That
 * argument is right about tabs and this file still makes it.
 *
 * It is not right about the **draft**. A draft's lifetime is "until published or
 * abandoned", not "until this tab closes", and the one moment we lean hardest on
 * that promise is the moment we throw the user out of the tab entirely. Google
 * and GitHub redirect in place, so `sessionStorage` survives them; the magic
 * link does not. It leaves for `/auth`, sends mail, and the link in that mail is
 * a plain `href` — the student opens it in a **new tab**, where per-tab storage
 * is empty by construction and no amount of care on this side can make it not
 * be. So the draft lives in `localStorage`, keyed by course, and carries a
 * `savedAt` so a week-old abandoned draft is dropped rather than kept forever —
 * which is the part of the `sessionStorage` argument worth keeping, expressed as
 * an explicit expiry instead of as a side effect of closing a tab.
 *
 * Nothing here is data either way. An open course and an unpublished draft have
 * no row anywhere, which is exactly why the browser is the right place for them.
 * A vote or a saved course would not belong here; those have tables.
 *
 * ## Every read is defensive, and a failed read is not a delete
 *
 * What comes back is whatever was in storage, which may be from an older build,
 * so anything that does not match the shape is dropped rather than trusted. But
 * "dropped" is narrower than it looks: the pane writes its state back over
 * storage, so anything this file refuses to decode is deleted a keystroke later.
 * A draft therefore salvages what it can — see `toDraft` — instead of failing
 * whole.
 */

const WORKSPACE_KEY = "cc.workspace.open";
const DRAFTS_KEY = "cc.workspace.drafts";
const PUBLISHED_KEY = "cc.workspace.published";
const AWAITING_SIGN_IN_KEY = "cc.workspace.awaiting-sign-in";

/**
 * How long an unpublished draft is kept.
 *
 * Long enough that "I will finish this after the exam" works, short enough that
 * a browser is not still holding half a review from last term. It is checked on
 * read; the pane writes its hydrated state straight back, so an expired entry is
 * gone from storage within a commit of being ignored.
 */
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const KINDS: OpenCourseKind[] = ["details", "review"];

/** The tab's storage, and the browser's. */
type Area = "session" | "local";

/**
 * Reading `window.localStorage` at all throws in a few real configurations —
 * a blocked third-party frame, Firefox with cookies disabled — so even getting
 * hold of the object is inside the guard, not just using it.
 */
function area(which: Area): Storage | null {
  try {
    return which === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function read(which: Area, key: string): unknown {
  try {
    const raw = area(which)?.getItem(key) ?? null;
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Reports whether the value landed. The migration below has to know. */
function write(which: Area, key: string, value: unknown): boolean {
  try {
    const store = area(which);
    if (!store) return false;
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // A browser with storage disabled or full still works; it just forgets.
    return false;
  }
}

function remove(which: Area, key: string): void {
  try {
    area(which)?.removeItem(key);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toOpenCourse(value: unknown): OpenCourse | null {
  if (!isRecord(value)) return null;
  const { id, courseCode, kind } = value;
  if (typeof id !== "string" || typeof courseCode !== "string") return null;
  if (!KINDS.includes(kind as OpenCourseKind)) return null;
  return { id, courseCode, kind: kind as OpenCourseKind };
}

export function readWorkspace(): Workspace {
  const value = read("session", WORKSPACE_KEY);
  if (!isRecord(value) || !Array.isArray(value.open)) return EMPTY_WORKSPACE;

  const open = value.open
    .map(toOpenCourse)
    .filter((entry): entry is OpenCourse => entry !== null);
  if (open.length === 0) return EMPTY_WORKSPACE;

  const activeId =
    typeof value.activeId === "string" &&
    open.some((entry) => entry.id === value.activeId)
      ? value.activeId
      : open[0].id;
  return { open, activeId };
}

export function writeWorkspace(workspace: Workspace): void {
  write("session", WORKSPACE_KEY, workspace);
}

function isExaminationKey(value: unknown): value is ExaminationKey {
  return (EXAMINATION_DISTRIBUTION_KEYS as readonly unknown[]).includes(value);
}

/** The examination split as `ReviewDraft` holds it: two parallel arrays. */
type ExaminationSplit = Pick<ReviewDraft, "methods" | "shares">;

/**
 * The stored examination split, or no split at all.
 *
 * `methods` and `shares` are parallel, always add up to 100, and name methods
 * *this* build knows about. A stored `"quiz"` from a build that offered one used
 * to be cast straight into `ExaminationKey[]` and reach the bar as a segment
 * with no colour and no label; a length mismatch used to reach `moveDivider` as
 * arithmetic over `undefined`.
 *
 * Anything that fails drops the split and **nothing else**. This check used to
 * reject the whole draft, and since the pane writes its state back over storage
 * on the next keystroke, a draft rejected here was a draft permanently deleted —
 * the write-up and the scores went with the one bad field. A split we cannot
 * read is a question left unanswered; the rest of the review is still the
 * writer's work and there is no reason to burn it.
 */
function toExaminationSplit(value: Record<string, unknown>): ExaminationSplit {
  const none: ExaminationSplit = { methods: [], shares: [] };

  const { methods, shares } = value;
  if (!Array.isArray(methods) || !Array.isArray(shares)) return none;
  if (methods.length !== shares.length || methods.length === 0) return none;

  const named = methods.filter(isExaminationKey);
  if (named.length !== methods.length) return none;
  if (new Set(named).size !== named.length) return none;

  const sizes = shares.filter(
    (share): share is number => typeof share === "number" && share > 0,
  );
  if (sizes.length !== shares.length) return none;
  if (sizes.reduce((total, share) => total + share, 0) !== 100) return none;

  return { methods: named, shares: sizes };
}

function toDraft(value: unknown): ReviewDraft | null {
  if (!isRecord(value)) return null;

  const score = (candidate: unknown) =>
    typeof candidate === "number" ? candidate : null;

  return {
    ...EMPTY_REVIEW_DRAFT,
    ...toExaminationSplit(value),
    examinationForgotten: value.examinationForgotten === true,
    approachTheoryPercent: score(value.approachTheoryPercent),
    approachForgotten: value.approachForgotten === true,
    workloadScore: score(value.workloadScore),
    learningScore: score(value.learningScore),
    happyTook: typeof value.happyTook === "boolean" ? value.happyTook : null,
    message: typeof value.message === "string" ? value.message : "",
  };
}

/** One course's draft with the clock reading that decides when to forget it. */
interface StoredDraft {
  savedAt: number;
  draft: ReviewDraft;
}

/**
 * Every stored draft that is still readable and still young enough, with its
 * stamp — the shape `readDrafts` presents and `writeDrafts` re-stamps against.
 */
function decodeStoredDrafts(): Record<string, StoredDraft> {
  const value = read("local", DRAFTS_KEY);
  if (!isRecord(value)) return {};

  const oldest = Date.now() - DRAFT_TTL_MS;
  const stored: Record<string, StoredDraft> = {};
  for (const [courseCode, entry] of Object.entries(value)) {
    if (!isRecord(entry)) continue;
    const { savedAt } = entry;
    if (typeof savedAt !== "number" || !Number.isFinite(savedAt)) continue;
    if (savedAt < oldest) continue;
    const draft = toDraft(entry.draft);
    if (draft) stored[courseCode] = { savedAt, draft };
  }
  return stored;
}

/**
 * Drafts the previous release left in `sessionStorage`, brought across once.
 *
 * The release this replaces wrote `{ [courseCode]: ReviewDraft }` under the
 * same key in the tab's storage. Without this, shipping the fix is itself the
 * data loss it fixes: every student with a half-written review open at deploy
 * time reloads into a blank form, and their tab still had the draft — it was
 * simply being looked for in the wrong place. A migration is cheap and the
 * alternative is a one-off outage of exactly the thing this PR is about.
 *
 * Deliberately conservative. The new format wins for any course present in
 * both, so a draft written since the deploy is never overwritten by the stale
 * copy the old tab left behind. An untouched legacy draft is not carried at
 * all — the old build stored those, the new one does not, and resurrecting one
 * would put an entry back that the student had cleared. The legacy key is
 * removed only once the new one has actually been written, so a browser that
 * refuses the write keeps the old value and can try again on the next read.
 *
 * It runs at most once per browser: the first read moves everything and drops
 * the key, and thereafter there is nothing to find.
 */
function adoptLegacyDrafts(
  stored: Record<string, StoredDraft>,
): Record<string, StoredDraft> | null {
  const legacy = read("session", DRAFTS_KEY);
  if (!isRecord(legacy)) return null;

  const now = Date.now();
  const merged: Record<string, StoredDraft> = { ...stored };
  for (const [courseCode, candidate] of Object.entries(legacy)) {
    if (courseCode in merged) continue;
    const draft = toDraft(candidate);
    if (!draft || isUntouched(draft)) continue;
    merged[courseCode] = { savedAt: now, draft };
  }

  if (write("local", DRAFTS_KEY, merged)) remove("session", DRAFTS_KEY);
  return merged;
}

function readStoredDrafts(): Record<string, StoredDraft> {
  const stored = decodeStoredDrafts();
  return adoptLegacyDrafts(stored) ?? stored;
}

export function readDrafts(): Record<string, ReviewDraft> {
  const drafts: Record<string, ReviewDraft> = {};
  for (const [courseCode, entry] of Object.entries(readStoredDrafts())) {
    drafts[courseCode] = entry.draft;
  }
  return drafts;
}

/**
 * Whether two drafts say the same thing.
 *
 * Only used to decide whether a stamp moves. Writing happens on every
 * keystroke — the pane mirrors its state to storage — and stamping every entry
 * on every write would mean the TTL measured "when this workspace was last
 * used" rather than "when this draft was last touched", so a draft abandoned in
 * one tab would be kept alive by work done in another course's tab beside it.
 * Never stamping would be worse: a draft edited daily would expire mid-edit.
 *
 * Field by field rather than by serialising: both sides are small, and the two
 * come from different places — one from `toDraft`, one from the panel's
 * spreads — so their key order is not something to bet a comparison on.
 */
function sameDraft(a: ReviewDraft, b: ReviewDraft): boolean {
  return (
    a.message === b.message &&
    a.happyTook === b.happyTook &&
    a.workloadScore === b.workloadScore &&
    a.learningScore === b.learningScore &&
    a.approachTheoryPercent === b.approachTheoryPercent &&
    a.approachForgotten === b.approachForgotten &&
    a.examinationForgotten === b.examinationForgotten &&
    a.methods.length === b.methods.length &&
    a.shares.length === b.shares.length &&
    a.methods.every((method, index) => method === b.methods[index]) &&
    a.shares.every((share, index) => share === b.shares[index])
  );
}

/**
 * Store what this pane has *changed*, and leave everything else alone.
 *
 * The second argument is what the pane's state held the last time it and
 * storage agreed — at hydration, and after each write. Without it this function
 * cannot tell the two meanings of "the pane is holding an old value" apart, and
 * both of them matter:
 *
 * - The pane has the same text it hydrated, and storage has since moved on.
 *   Another tab wrote it. This tab has nothing to say and must say nothing.
 * - The pane's text differs from what it last synchronised. This tab edited it,
 *   and its version is the one the student is looking at.
 *
 * Comparing against storage alone cannot separate those — a difference between
 * memory and storage is equally consistent with either — so `synced` is passed
 * in rather than guessed at. That is what stops a tab from carrying its whole
 * hydrated record forward and writing a stale copy of course A back over a
 * newer one, on its way to saving an unrelated draft for course B.
 *
 * The two other rules fall out of the same idea. A course the pane has never
 * heard of is somebody else's and is carried through untouched. A course the
 * pane holds as an untouched draft *and has changed since syncing* has been
 * cleared, and the entry goes — that is how publishing tidies up after itself,
 * and how a writer who selects all and deletes gets what they asked for rather
 * than their old text back on the next page load.
 *
 * Two tabs editing the *same* course still race, and the last write wins. That
 * is the race two tabs have always had over one draft, and the losing tab still
 * has its own copy on screen; what is fixed here is the tab that was not
 * editing that course at all.
 */
export function writeDrafts(
  drafts: Record<string, ReviewDraft>,
  synced: Record<string, ReviewDraft>,
): void {
  const stored = readStoredDrafts();
  const now = Date.now();
  const changed = (courseCode: string, draft: ReviewDraft) =>
    !sameDraft(synced[courseCode] ?? EMPTY_REVIEW_DRAFT, draft);

  const next: Record<string, StoredDraft> = {};
  for (const [courseCode, entry] of Object.entries(stored)) {
    const draft = drafts[courseCode];
    if (draft === undefined || !changed(courseCode, draft)) {
      next[courseCode] = entry;
      continue;
    }
    if (isUntouched(draft)) continue;
    const unchanged = sameDraft(entry.draft, draft);
    next[courseCode] = { savedAt: unchanged ? entry.savedAt : now, draft };
  }

  for (const [courseCode, draft] of Object.entries(drafts)) {
    if (courseCode in stored) continue;
    if (isUntouched(draft) || !changed(courseCode, draft)) continue;
    next[courseCode] = { savedAt: now, draft };
  }

  write("local", DRAFTS_KEY, next);
}

/**
 * When this workspace published a review, by course code.
 *
 * The review itself is the durable record and `reviews.list` is where the pane
 * reads it from — but that is a refetch away, and a review tab reopened before
 * it lands would offer a second draft for a review that already exists. This
 * is the workspace's own memory of what it sent, which needs no round trip.
 *
 * It stays in `sessionStorage` while the draft moves out, and the difference is
 * what each one is for. The draft is the student's unfinished work and has to
 * follow them into whatever tab the sign-in link opens. This is a stopgap for
 * one request in flight, and `reviews.list` — the real record — answers within
 * seconds of the tab that published. A tab that never asked has nothing to be
 * stopped from doing.
 *
 * It carries *when*, not just *that*, because it has to know which list
 * responses came after it: a response fetched before the write says nothing
 * about the write, and one fetched after it is the authority either way — the
 * review is there, or somebody deleted it and its author may write another.
 */
export function readPublished(): Record<string, number> {
  const value = read("session", PUBLISHED_KEY);
  if (!isRecord(value)) return {};

  const published: Record<string, number> = {};
  for (const [courseCode, at] of Object.entries(value)) {
    if (typeof at === "number" && Number.isFinite(at))
      published[courseCode] = at;
  }
  return published;
}

export function writePublished(published: Record<string, number>): void {
  write("session", PUBLISHED_KEY, published);
}

/**
 * Which course was waiting on a sign-in when the page navigated away.
 *
 * Set when the draft asks a visitor to sign in, claimed by that same course's
 * draft when the pane comes back. It is a one-shot note to the next page load,
 * so claiming it clears it — and only the course it names may claim it, or a
 * different tab coming forward first would swallow the note.
 *
 * `sessionStorage`, deliberately, even though the draft it accompanies is not.
 * The note only drives a greeting — "Signed in. Your draft came back untouched"
 * — and that sentence is only true of the tab that was thrown out and came
 * back. The magic link opens a *new* tab, which was never thrown out of
 * anything and has nothing to reassure anyone about; the draft still arrives
 * there, from `localStorage`, without a note about it.
 */
export function markAwaitingSignIn(courseCode: string): void {
  write("session", AWAITING_SIGN_IN_KEY, courseCode);
}

export function claimAwaitingSignIn(courseCode: string): boolean {
  if (read("session", AWAITING_SIGN_IN_KEY) !== courseCode) return false;
  clearAwaitingSignIn(courseCode);
  return true;
}

/** Drop the note unclaimed — the visitor backed out of the dialog. */
export function clearAwaitingSignIn(courseCode: string): void {
  if (read("session", AWAITING_SIGN_IN_KEY) !== courseCode) return;
  remove("session", AWAITING_SIGN_IN_KEY);
}
