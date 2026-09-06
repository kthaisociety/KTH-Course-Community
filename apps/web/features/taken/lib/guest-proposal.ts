"use client";

import type {
  TranscriptProposal,
  TranscriptProposalRow,
} from "@/server/ingest/transcript/service";

/**
 * The one thing a signed-out reader's transcript leaves behind, and only across
 * a sign-in.
 *
 * The artboard gates the transcript flow at the *keep* step: a guest drops a
 * PDF in, reads what came out, and the confirm button says "Sign in to keep
 * this list" — then `{ screen: "auth", returnTo: "list", pending: "confirm" }`,
 * and after the sign-in "the action that asked for the account finishes itself"
 * (`docs/design_ref/2026-09-06/Course Community - Taken Courses.dc.html:1305-1308`,
 * `:1247-1250`).
 *
 * In the artboard that resume is free, because its sign-in is a `setState`. Ours
 * is a round trip through somebody else's site: Google and GitHub redirect the
 * page away, and the magic link leaves for `/auth`, sends mail, and is opened in
 * a **new tab**. React state does not survive either. So the proposal is written
 * down, or "Sign in to keep this list" is a promise that loses the list.
 *
 * This is the same problem `features/workspace/lib/workspace-storage.ts` solved
 * for an unpublished review draft, and the same answer for the same reasons —
 * `localStorage` rather than `sessionStorage`, because per-tab storage is empty
 * by construction in the tab the mailed link opens.
 *
 * ## What is kept, and what is deliberately dropped
 *
 * A proposal is not a file. `POST /api/user/transcript` parses the PDF and
 * returns candidate rows; the file itself is never in state, never in a cache
 * and never here — `transcript-drop-zone.tsx` states that rule and it is
 * untouched. What is written down is the handful of rows the reader is about to
 * confirm.
 *
 * **Grades are dropped unless the reader asked to keep them.** With the grades
 * switch off, `planTranscriptImport` throws the grades away at confirm time
 * anyway, and the artboard's own copy for that state is "no grade of yours is
 * stored anywhere" (`… - Taken Courses.dc.html:1296`). Carrying them through a
 * sign-in would make that false for the sake of data the confirm is going to
 * discard, so they are stripped before the write rather than after the read.
 *
 * **It expires, in minutes rather than days.** The window it has to survive is
 * one sign-in; the magic link itself lasts five minutes (`server/auth.ts`).
 * Half an hour covers a slow inbox and nothing else. A record older than that is
 * dropped on read, so a transcript read on a shared machine is not still sitting
 * there tomorrow.
 *
 * **Only a guest ever writes one.** A signed-in reader confirms in place and
 * never reaches this file, so there is no second account's data to keep apart —
 * the owner-keying `workspace-storage.ts` needs does not apply. The record is
 * cleared the moment it is claimed.
 *
 * ## One key, whole-record writes
 *
 * `guest-saves.ts` splits its list across one key per course, because a list
 * under one key makes every change a read-modify-write that two tabs can
 * clobber. Nothing here is a list being edited: the record is written once by
 * the tab that parsed the file and read once by the tab that comes back, whole
 * both times. Two tabs each parsing a transcript is one tab's proposal winning,
 * which is the same thing that happens on one screen and is not a lost write.
 */

const KEY = "kth-cc:taken-proposal";

/** How long a stored proposal is honoured. */
export const GUEST_PROPOSAL_TTL_MS = 30 * 60 * 1000;

/** A parsed transcript waiting for the account that will keep it. */
export type StoredGuestProposal = {
  proposal: TranscriptProposal;
  /** The reader's grades switch, carried so the confirm plans the same way. */
  includeGrades: boolean;
};

type Record_ = StoredGuestProposal & { savedAt: number };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * One candidate row, or `null`.
 *
 * A row with no course code cannot be confirmed — `user_taken_courses.course_code`
 * is a foreign key to `courses.code` — so that is the one field whose absence
 * drops the row. The rest are display or self-reported and are salvaged to
 * their empty value, which is the same shape a transcript that printed nothing
 * for them produces.
 */
function decodeRow(value: unknown): TranscriptProposalRow | null {
  if (!isObject(value)) return null;
  const courseCode =
    typeof value.courseCode === "string" ? value.courseCode : "";
  if (!courseCode) return null;
  return {
    courseCode,
    transcriptName: stringOr(value.transcriptName, courseCode),
    catalogueName: stringOr(value.catalogueName, courseCode),
    grade: typeof value.grade === "string" ? value.grade : null,
    earnedCredits: numberOrNull(value.earnedCredits),
    attendanceYear: numberOrNull(value.attendanceYear),
  };
}

function decodeUnmatched(
  value: unknown,
): { courseCode: string; courseName: string } | null {
  if (!isObject(value)) return null;
  const courseCode =
    typeof value.courseCode === "string" ? value.courseCode : "";
  if (!courseCode) return null;
  return { courseCode, courseName: stringOr(value.courseName, courseCode) };
}

/**
 * What is safe to write down, given the reader's grades switch.
 *
 * Pure and exported so the rule above is testable without a browser: with the
 * switch off there is no grade in the record at all, not a grade that something
 * downstream is trusted to ignore.
 */
export function forStorage(
  proposal: TranscriptProposal,
  includeGrades: boolean,
): TranscriptProposal {
  if (includeGrades) return proposal;
  return {
    ...proposal,
    candidates: proposal.candidates.map((row) => ({ ...row, grade: null })),
  };
}

/**
 * Holds one proposal for the sign-in that is about to happen.
 *
 * Every access to `localStorage` is wrapped: it throws outright in a browser
 * set to block site data and in Safari's private mode. A reader who has turned
 * storage off loses the resume and keeps the page, which is the right failure.
 */
export function writeGuestProposal(
  proposal: TranscriptProposal,
  includeGrades: boolean,
): void {
  try {
    const record: Record_ = {
      proposal: forStorage(proposal, includeGrades),
      includeGrades,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    /* storage unavailable — the reader re-reads the file instead */
  }
}

/**
 * The waiting proposal, or `null`.
 *
 * Defensive throughout: what comes back is whatever is in this browser's
 * storage, possibly written by an older build and possibly not written by us at
 * all. Anything that is not a record of rows with course codes in it is dropped
 * rather than trusted.
 */
export function readGuestProposal(
  now: number = Date.now(),
): StoredGuestProposal | null {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(parsed)) return null;

  const savedAt = numberOrNull(parsed.savedAt);
  if (savedAt === null || now - savedAt > GUEST_PROPOSAL_TTL_MS) return null;
  if (!isObject(parsed.proposal)) return null;

  const { candidates, unmatched } = parsed.proposal;
  const rows = (Array.isArray(candidates) ? candidates : [])
    .map(decodeRow)
    .filter((row): row is TranscriptProposalRow => row !== null);
  if (rows.length === 0) return null;

  const includeGrades = parsed.includeGrades === true;
  return {
    includeGrades,
    proposal: {
      // Read through the same filter the write used. A record written before
      // the switch existed, or edited in the console, cannot smuggle a grade
      // past a reader who turned grades off.
      candidates: forStorage({ candidates: rows, unmatched: [] }, includeGrades)
        .candidates,
      unmatched: (Array.isArray(unmatched) ? unmatched : [])
        .map(decodeUnmatched)
        .filter(
          (row): row is { courseCode: string; courseName: string } =>
            row !== null,
        ),
    },
  };
}

/** Forgets the waiting proposal — claimed, discarded, or confirmed. */
export function clearGuestProposal(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable — there was nothing to clear */
  }
}
