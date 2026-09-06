"use client";

import { Info } from "lucide-react";
import type { TranscriptProposal } from "@/server/ingest/transcript/service";
import { creditsLabel } from "../lib/taken-rows";

type Props = {
  proposal: TranscriptProposal;
  /** The reader's grades switch, applied to what is shown and to what is written. */
  includeGrades: boolean;
  /** Whether there is an account to write to. Decides the confirm's wording. */
  isSignedIn: boolean;
  /** Whether these rows came back across a sign-in rather than off a fresh read. */
  isResumed?: boolean;
  isConfirming: boolean;
  /**
   * Set when a confirm did not finish. Some of it may already have landed, so
   * the message says what confirming again will do rather than claiming
   * nothing was written — the screen re-reads the list and asks only for the
   * rows that are still missing.
   */
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

function headline(count: number): string {
  return count === 1 ? "1 course read" : `${count} courses read`;
}

/** The artboard's `confirmCta`, plus the in-flight word this page needs. */
function confirmLabel(isSignedIn: boolean, isConfirming: boolean): string {
  if (!isSignedIn) return "Sign in to keep this list";
  return isConfirming ? "Saving…" : "Looks right";
}

function unmatchedTitle(count: number): string {
  return count === 1
    ? "1 row was not a KTH catalogue course"
    : `${count} rows were not KTH catalogue courses`;
}

/**
 * What a parsed transcript is offering, before any of it is written —
 * the artboard's `isPreview` screen.
 *
 * Two rules from #66's server work are visible here and must stay that way.
 * **Nothing is stored until "Looks right".** The rows on this screen came back
 * from a parse that wrote nothing; every write this flow makes is behind that
 * button, and `planTranscriptImport` decides what they are.
 *
 * **Unmatched codes are reported, never invented.** A row whose course code the
 * catalogue does not have cannot become a taken course — `user_taken_courses`
 * has a foreign key to `courses.code` — so it is named here rather than dropped
 * silently, and this screen offers no way to create the missing course.
 *
 * The candidate rows are listed, which the artboard's own preview does not do:
 * it shows only a count. A screen whose one button writes to a reader's record
 * has to show what it is about to write.
 *
 * **Signed out, the button asks for the account instead of writing.**
 * `confirmCta: s.signedIn ? "Looks right" : "Sign in to keep this list"` is the
 * artboard's own line (`docs/design_ref/2026-09-06/Course Community - Taken
 * Courses.dc.html:1305`), and it is the whole shape of the guest flow: the
 * transcript is read, the rows are shown, and the account is asked for at the
 * step that would keep them. Nothing on this screen has been stored either way.
 */
export function TranscriptProposalReview({
  proposal,
  includeGrades,
  isSignedIn,
  isResumed = false,
  isConfirming,
  error,
  onConfirm,
  onCancel,
}: Props) {
  const { candidates, unmatched } = proposal;

  return (
    <div className="flex justify-center px-5 pt-[30px] pb-10">
      <div className="w-full max-w-[560px]">
        <p className="m-0 font-semibold text-[11px] text-cc-brand uppercase tracking-[0.09em]">
          Transcript read
        </p>
        <h2 className="m-0 mt-2.5 font-semibold text-[24px] leading-[1.2] tracking-[-0.015em]">
          {headline(candidates.length)}
        </h2>
        <p className="m-0 mt-2 text-[14px] text-cc-muted leading-[1.55]">
          Nothing is saved to your list until you confirm.
        </p>

        {unmatched.length > 0 ? (
          <div className="mt-4 flex items-start gap-[11px] rounded-[11px] border border-cc-rule2 bg-cc-pill px-[15px] py-[13px]">
            <Info
              size={16}
              strokeWidth={2}
              aria-hidden
              className="mt-px flex-none text-cc-dim"
            />
            <div className="min-w-0 flex-1">
              <p className="m-0 font-semibold text-[13.5px]">
                {unmatchedTitle(unmatched.length)}
              </p>
              <p className="m-0 mt-1 text-[12.5px] text-cc-muted leading-[1.5]">
                These rows do not match a course in the KTH catalogue, so they
                are left out.
              </p>
              <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
                {unmatched.map((row) => (
                  <li
                    key={row.courseCode}
                    className="truncate text-[12.5px] text-cc-ink2"
                  >
                    {row.courseCode} — {row.courseName}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        {candidates.length > 0 ? (
          <ul className="scrollbar-subtle m-0 mt-4 flex max-h-[320px] list-none flex-col overflow-y-auto rounded-[12px] border border-cc-rule bg-cc-surface p-0">
            {candidates.map((row) => (
              <li
                key={row.courseCode}
                className="flex items-center gap-3 border-cc-rule border-b px-4 py-2.5 last:border-b-0"
              >
                <span className="w-[74px] flex-none font-medium font-mono text-[12.5px] text-cc-brand">
                  {row.courseCode}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13.5px]">
                  {row.catalogueName}
                </span>
                <span className="flex-none text-[12.5px] text-cc-dim tabular-nums">
                  {creditsLabel(row.earnedCredits)}
                </span>
                <span className="w-[52px] flex-none text-right text-[12.5px] text-cc-ink2">
                  {includeGrades ? (row.grade ?? "—") : "not kept"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 mt-4 rounded-[12px] border border-cc-rule bg-cc-surface px-4 py-3.5 text-[13px] text-cc-muted leading-[1.55]">
            No row in that file matched a course in the KTH catalogue, so there
            is nothing to add. Nothing was saved.
          </p>
        )}

        {isResumed ? (
          // The artboard resumes the confirm itself once the account appears.
          // This says where the rows came from instead, because the click is
          // still the reader's — `taken-courses.tsx` says why it stays theirs.
          <output className="mt-4 block rounded-[10px] border border-cc-rule2 bg-cc-pill px-[13px] py-[11px] text-[12.5px] text-cc-ink2 leading-[1.5]">
            You are signed in, and the transcript you read is still here.
            Confirm it to keep these courses.
          </output>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="m-0 mt-4 rounded-[10px] border border-cc-danger/40 bg-cc-surface px-[13px] py-[11px] text-[12.5px] text-cc-danger"
          >
            {error} Confirming again writes only what is still missing.
          </p>
        ) : null}

        <div className="mt-5 flex items-center gap-[11px]">
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming || candidates.length === 0}
            className="flex h-11 cursor-pointer items-center rounded-[9px] bg-cc-btn px-5 font-semibold text-[14px] text-cc-btn-fg hover:opacity-[0.88] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {confirmLabel(isSignedIn, isConfirming)}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-11 cursor-pointer items-center rounded-[9px] border border-cc-rule3 bg-cc-surface px-4 font-medium text-[13.5px] text-cc-chip-ink hover:border-cc-hov"
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}
