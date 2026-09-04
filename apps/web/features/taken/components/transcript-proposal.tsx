"use client";

import { Info } from "lucide-react";
import type { TranscriptProposal } from "@/server/ingest/transcript/service";
import { creditsLabel } from "../lib/taken-rows";

type Props = {
  proposal: TranscriptProposal;
  /** The reader's grades switch, applied to what is shown and to what is written. */
  includeGrades: boolean;
  isConfirming: boolean;
  /** Set when `transcript.confirm` refused the rows. Nothing was written. */
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

function headline(count: number): string {
  return count === 1 ? "1 course read" : `${count} courses read`;
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
 * from a parse that wrote nothing; `transcript.confirm` is the only write, and
 * it is behind that button.
 *
 * **Unmatched codes are reported, never invented.** A row whose course code the
 * catalogue does not have cannot become a taken course — `user_taken_courses`
 * has a foreign key to `courses.code` — so it is named here rather than dropped
 * silently, and this screen offers no way to create the missing course.
 *
 * The candidate rows are listed, which the artboard's own preview does not do:
 * it shows only a count. A screen whose one button writes to a reader's record
 * has to show what it is about to write.
 */
export function TranscriptProposalReview({
  proposal,
  includeGrades,
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
          <ul className="m-0 mt-4 flex max-h-[320px] list-none flex-col overflow-y-auto rounded-[12px] border border-cc-rule bg-cc-surface p-0">
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

        {error ? (
          <p
            role="alert"
            className="m-0 mt-4 rounded-[10px] border border-cc-danger/40 bg-cc-surface px-[13px] py-[11px] text-[12.5px] text-cc-danger"
          >
            {error} Nothing was saved.
          </p>
        ) : null}

        <div className="mt-5 flex items-center gap-[11px]">
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming || candidates.length === 0}
            className="flex h-11 cursor-pointer items-center rounded-[9px] bg-cc-btn px-5 font-semibold text-[14px] text-cc-btn-fg hover:opacity-[0.88] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isConfirming ? "Saving…" : "Looks right"}
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
