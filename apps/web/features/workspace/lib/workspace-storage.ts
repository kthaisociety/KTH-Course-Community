import {
  EMPTY_WORKSPACE,
  type OpenCourse,
  type OpenCourseKind,
  type Workspace,
} from "./open-courses";
import { EMPTY_REVIEW_DRAFT, type ReviewDraft } from "./review-draft";

/**
 * What the workspace keeps across a page load, and why it has to.
 *
 * Signing in is an OAuth redirect: the page navigates away and comes back, and
 * everything in React state goes with it. `AuthReasonDialog` promises the
 * opposite — "Your draft is held as it is — text, ratings and the course all
 * stay put" — and the artboard says the same in its own words. Keeping that
 * promise is the whole reason this file exists.
 *
 * `sessionStorage`, not `localStorage`: an open workspace belongs to the tab
 * the student is working in, and it should not still be there next week. And
 * nothing here is data — an open course and an unpublished draft have no row
 * anywhere, which is exactly why the browser is the right place for them. A
 * vote or a saved course would not belong here; those have tables.
 *
 * Every read is defensive. What comes back is whatever was in the tab's
 * storage, which may be from an older build, so anything that does not match
 * the shape is dropped rather than trusted.
 */

const WORKSPACE_KEY = "cc.workspace.open";
const DRAFTS_KEY = "cc.workspace.drafts";
const PUBLISHED_KEY = "cc.workspace.published";
const AWAITING_SIGN_IN_KEY = "cc.workspace.awaiting-sign-in";

const KINDS: OpenCourseKind[] = ["details", "review"];

function read(key: string): unknown {
  try {
    const raw = sessionStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A tab with storage disabled or full still works; it just forgets.
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
  const value = read(WORKSPACE_KEY);
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
  write(WORKSPACE_KEY, workspace);
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
    methods: methods as ReviewDraft["methods"],
    shares,
    examinationForgotten: value.examinationForgotten === true,
    approachTheoryPercent: score(value.approachTheoryPercent),
    approachForgotten: value.approachForgotten === true,
    workloadScore: score(value.workloadScore),
    learningScore: score(value.learningScore),
    happyTook: typeof value.happyTook === "boolean" ? value.happyTook : null,
    message: typeof value.message === "string" ? value.message : "",
  };
}

export function readDrafts(): Record<string, ReviewDraft> {
  const value = read(DRAFTS_KEY);
  if (!isRecord(value)) return {};

  const drafts: Record<string, ReviewDraft> = {};
  for (const [courseCode, candidate] of Object.entries(value)) {
    const draft = toDraft(candidate);
    if (draft) drafts[courseCode] = draft;
  }
  return drafts;
}

export function writeDrafts(drafts: Record<string, ReviewDraft>): void {
  write(DRAFTS_KEY, drafts);
}

/**
 * The courses reviewed from this workspace.
 *
 * The review itself is the durable record and `reviews.list` is where the pane
 * reads it from — but that is a refetch away, and a review tab reopened before
 * it lands would offer a second draft for a review that already exists. This
 * is the workspace's own memory of what it sent, which needs no round trip and
 * survives the tab being closed and reopened.
 */
export function readPublished(): string[] {
  const value = read(PUBLISHED_KEY);
  if (!Array.isArray(value)) return [];
  return value.filter((code): code is string => typeof code === "string");
}

export function writePublished(courseCodes: string[]): void {
  write(PUBLISHED_KEY, courseCodes);
}

/**
 * Which course was waiting on a sign-in when the page navigated away.
 *
 * Set when the draft asks a visitor to sign in, claimed by that same course's
 * draft when the pane comes back. It is a one-shot note to the next page load,
 * so claiming it clears it — and only the course it names may claim it, or a
 * different tab coming forward first would swallow the note.
 */
export function markAwaitingSignIn(courseCode: string): void {
  write(AWAITING_SIGN_IN_KEY, courseCode);
}

export function claimAwaitingSignIn(courseCode: string): boolean {
  if (read(AWAITING_SIGN_IN_KEY) !== courseCode) return false;
  clearAwaitingSignIn(courseCode);
  return true;
}

/** Drop the note unclaimed — the visitor backed out of the dialog. */
export function clearAwaitingSignIn(courseCode: string): void {
  if (read(AWAITING_SIGN_IN_KEY) !== courseCode) return;
  try {
    sessionStorage.removeItem(AWAITING_SIGN_IN_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
