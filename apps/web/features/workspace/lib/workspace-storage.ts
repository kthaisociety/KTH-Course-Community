import {
  EMPTY_WORKSPACE,
  type OpenCourse,
  type OpenCourseKind,
  type Workspace,
} from "./open-courses";
import {
  decodeReviewDraft,
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
 * ## A draft belongs to one account, and a browser is shared
 *
 * `localStorage` is the browser's, not the account's. Keyed by course alone, a
 * draft written by whoever was signed in last is handed to whoever signs in
 * next: they open the same course, hydrate someone else's unpublished text and
 * answers, and can publish it under their own name. So the record is keyed by
 * **owner first** — `{ [userId]: { [courseCode]: StoredDraft } }` - and a read
 * is given only the bucket belonging to the account asking.
 *
 * The empty string is the owner key for a visitor, which is what
 * `useSessionData` already reports as `userId` with no session, and is not a
 * value Better Auth can issue. That bucket is the hand-off the paragraphs above
 * exist for: a draft begun signed-out has no owner to protect, so the first
 * account to read it **claims** it — the entries move into that account's
 * bucket and the anonymous one is dropped, which keeps the sign-in promise
 * without leaving a copy behind for the next account. The residue is narrow and
 * deliberate: two people sharing a browser profile, both signed out, can still
 * see each other's anonymous drafts. Nothing distinguishes them at that point,
 * and refusing the hand-off would break the magic-link flow this file exists
 * to serve.
 *
 * ## Every read is defensive, and a failed read is not a delete
 *
 * What comes back is whatever was in storage, which may be from an older build,
 * so anything that does not match the shape is dropped rather than trusted. But
 * "dropped" is narrower than it looks: the pane writes its state back over
 * storage, so anything this file refuses to decode is deleted a keystroke later.
 * A draft therefore salvages what it can, instead of failing whole.
 *
 * The salvaging is `decodeReviewDraft`'s, in `./review-draft.ts`, which extends
 * `features/reviews/lib/review-draft.ts`'s decoder with the pane's two flags.
 * This file used to hold a second hand-written copy of it, and the fast-track
 * reviewer a third; #166 is what they cost. The three refusals left in this file
 * are its own and none of them is a field: an entry that is not an object, one
 * with no `savedAt`, and one whose stamp has expired. Those are deliberate, and
 * the last of them is the whole point of the stamp.
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

/** One course's draft with the clock reading that decides when to forget it. */
interface StoredDraft {
  savedAt: number;
  draft: ReviewDraft;
}

/** Whose drafts these are: a Better Auth user id, or `ANONYMOUS`. */
export type DraftOwner = string;

/**
 * The bucket a signed-out visitor writes under.
 *
 * `useSessionData` reports `userId: ""` with no session, so the empty string is
 * already the value a caller has in hand, and no real id can collide with it.
 */
const ANONYMOUS: DraftOwner = "";

/** Every account's drafts, kept apart. */
type DraftBuckets = Record<DraftOwner, Record<string, StoredDraft>>;

/** One owner's stored drafts: readable, and still young enough. */
function decodeBucket(
  value: unknown,
  oldest: number,
): Record<string, StoredDraft> {
  if (!isRecord(value)) return {};

  const bucket: Record<string, StoredDraft> = {};
  for (const [courseCode, entry] of Object.entries(value)) {
    if (!isRecord(entry)) continue;
    const { savedAt } = entry;
    if (typeof savedAt !== "number" || !Number.isFinite(savedAt)) continue;
    if (savedAt < oldest) continue;
    const draft = decodeReviewDraft(entry.draft);
    if (draft) bucket[courseCode] = { savedAt, draft };
  }
  return bucket;
}

/**
 * Whether this is the unowned record the previous release wrote.
 *
 * That shape was `{ [courseCode]: StoredDraft }`, so its values carry a numeric
 * `savedAt`; a bucket's values are records of those and carry none. One stamped
 * value is enough to tell them apart, and an empty record is neither.
 */
function isUnownedRecord(value: Record<string, unknown>): boolean {
  return Object.values(value).some(
    (entry) => isRecord(entry) && typeof entry.savedAt === "number",
  );
}

/**
 * Every stored draft that is still readable and still young enough, by owner.
 *
 * An unowned record from the previous release becomes the anonymous bucket, to
 * be claimed by the first account that reads it. Dropping those instead would
 * make shipping this fix the data loss it prevents — the same argument
 * `adoptLegacyDrafts` makes below — and no owner was recorded to restore them
 * to, so claiming is the only thing the format can honestly do with them.
 */
function decodeBuckets(): DraftBuckets {
  const value = read("local", DRAFTS_KEY);
  if (!isRecord(value)) return {};

  const oldest = Date.now() - DRAFT_TTL_MS;
  if (isUnownedRecord(value)) {
    const inherited = decodeBucket(value, oldest);
    return Object.keys(inherited).length > 0 ? { [ANONYMOUS]: inherited } : {};
  }

  const buckets: DraftBuckets = {};
  for (const [owner, entries] of Object.entries(value)) {
    const bucket = decodeBucket(entries, oldest);
    if (Object.keys(bucket).length > 0) buckets[owner] = bucket;
  }
  return buckets;
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
 * They arrive unowned, so they land in the anonymous bucket and are claimed by
 * the first account to read them. The tab knew who was typing; the storage it
 * wrote did not record it, and inventing an owner here would be a guess.
 *
 * Deliberately conservative. A course already held in **any** owner's bucket
 * wins, so a draft written since the deploy is never overwritten by the stale
 * copy the old tab left behind, and a tab's leftover copy can never displace a
 * draft that now belongs to an account. An untouched legacy draft is not
 * carried at all — the old build stored those, the new one does not, and
 * resurrecting one would put an entry back that the student had cleared. The
 * legacy key is removed only once the new one has actually been written, so a
 * browser that refuses the write keeps the old value and can try again on the
 * next read.
 *
 * It runs at most once per tab, which is where the old key lives: the first
 * read moves that tab's drafts across and drops its key, and thereafter there
 * is nothing to find. A second tab still carrying its own legacy value gets the
 * same treatment when it reloads into this build, and the rule above is what
 * keeps its staler copy from displacing what the first tab already moved.
 */
function adoptLegacyDrafts(buckets: DraftBuckets): DraftBuckets | null {
  const legacy = read("session", DRAFTS_KEY);
  if (!isRecord(legacy)) return null;

  const now = Date.now();
  const claimed = new Set(
    Object.values(buckets).flatMap((bucket) => Object.keys(bucket)),
  );
  const anonymous = { ...(buckets[ANONYMOUS] ?? {}) };
  for (const [courseCode, candidate] of Object.entries(legacy)) {
    if (claimed.has(courseCode)) continue;
    const draft = decodeReviewDraft(candidate);
    if (!draft || isUntouched(draft)) continue;
    anonymous[courseCode] = { savedAt: now, draft };
  }

  const merged: DraftBuckets = { ...buckets };
  if (Object.keys(anonymous).length > 0) merged[ANONYMOUS] = anonymous;
  if (write("local", DRAFTS_KEY, merged)) remove("session", DRAFTS_KEY);
  return merged;
}

function readBuckets(): DraftBuckets {
  const buckets = decodeBuckets();
  return adoptLegacyDrafts(buckets) ?? buckets;
}

/**
 * What one owner may see: its own drafts, over any it is about to claim.
 *
 * The anonymous bucket is merged in underneath so a draft begun before signing
 * in survives the redirect, and the owner's own entry wins where both hold the
 * same course — that one was written by this account, knowingly.
 */
function visibleTo(
  buckets: DraftBuckets,
  owner: DraftOwner,
): Record<string, StoredDraft> {
  const inherited = owner === ANONYMOUS ? {} : (buckets[ANONYMOUS] ?? {});
  return { ...inherited, ...(buckets[owner] ?? {}) };
}

export function readDrafts(owner: DraftOwner): Record<string, ReviewDraft> {
  const drafts: Record<string, ReviewDraft> = {};
  for (const [courseCode, entry] of Object.entries(
    visibleTo(readBuckets(), owner),
  )) {
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
 * come from different places — one from `decodeReviewDraft`, one from the
 * panel's spreads — so their key order is not something to bet a comparison on.
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
  owner: DraftOwner,
): void {
  const buckets = readBuckets();
  const stored = visibleTo(buckets, owner);
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

  const nextBuckets: DraftBuckets = { ...buckets };
  if (Object.keys(next).length > 0) nextBuckets[owner] = next;
  else delete nextBuckets[owner];
  // Claiming is a move, not a copy. Everything the anonymous bucket held is in
  // `next` now — `visibleTo` put it there and the loops above carried it
  // through untouched - so dropping it is what stops the next account in this
  // browser from finding a second copy.
  if (owner !== ANONYMOUS) delete nextBuckets[ANONYMOUS];
  write("local", DRAFTS_KEY, nextBuckets);
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
