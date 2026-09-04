"use client";

import { Check, CircleCheck, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import {
  creditsLabel,
  draftEdits,
  type TakenEdits,
  type TakenRow,
} from "../lib/taken-rows";

/**
 * The list's seven columns, shared by the header and every row so the two can
 * never drift. Straight from the artboard's own `grid-template-columns`.
 */
export const TAKEN_GRID =
  "grid w-full min-w-[640px] box-border items-center gap-[clamp(8px,1.4vw,18px)] [grid-template-columns:minmax(64px,96px)_minmax(140px,1fr)_minmax(50px,70px)_minmax(64px,90px)_minmax(50px,70px)_minmax(76px,108px)_minmax(110px,170px)]";

const ICON_BUTTON =
  "flex size-[30px] flex-none cursor-pointer items-center justify-center rounded-[7px] border border-cc-rule3 bg-cc-surface disabled:cursor-not-allowed disabled:opacity-50";

type Props = {
  row: TakenRow;
  /**
   * Whether this course carries a review by the viewer, or `null` when the
   * review lists did not load. Null renders neither "Done" nor "Not yet":
   * a course whose reviews are unknown is not the same as one with none, and
   * a taken row carries no satisfaction state of its own to fall back on.
   */
  isReviewed: boolean | null;
  /** A write for this row is in flight; its controls wait for it. */
  isBusy: boolean;
  onSave: (edits: TakenEdits) => void;
  onRemove: () => void;
};

/**
 * One taken course in the list, with the artboard's in-place editor for the
 * three self-reported fields it shows.
 *
 * Credits, grade and year are the student's own entries — a transcript is not
 * authoritative and an imported row stays editable, which is why the pencil is
 * offered on every row regardless of where the row came from. Editing does not
 * change its provenance: `taken.update` preserves `transcript_imported_at`.
 */
export function TakenCourseRow({
  row,
  isReviewed,
  isBusy,
  onSave,
  onRemove,
}: Props) {
  const [draft, setDraft] = useState<{
    grade: string;
    credits: string;
    year: string;
  } | null>(null);

  const edits = draft === null ? null : draftEdits(draft);

  function startEditing() {
    setDraft({
      grade: row.grade ?? "",
      credits: row.earnedCredits === null ? "" : String(row.earnedCredits),
      year: row.attendanceYear === null ? "" : String(row.attendanceYear),
    });
  }

  function save() {
    if (!edits) return;
    setDraft(null);
    onSave(edits);
  }

  return (
    <div
      className={`${TAKEN_GRID} border-cc-rule border-b px-4 py-[11px] hover:bg-cc-pg`}
    >
      <div className="font-medium font-mono text-[13px] text-cc-brand">
        {row.courseCode}
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate font-medium text-[13.5px]">{row.name}</span>
        {row.transcriptImportedAt ? (
          <span className="flex-none rounded-[5px] bg-cc-pill px-[7px] py-0.5 font-medium text-[11px] text-cc-muted">
            Imported
          </span>
        ) : null}
      </div>

      {draft ? (
        <input
          value={draft.credits}
          inputMode="decimal"
          aria-label={`Credits for ${row.courseCode}`}
          onChange={(event) =>
            setDraft({ ...draft, credits: event.target.value })
          }
          className="box-border h-7 w-14 rounded-[6px] border border-cc-brand px-1.5 text-[13px] text-cc-ink outline-none"
        />
      ) : (
        <div className="text-[13px] text-cc-ink2 tabular-nums">
          {creditsLabel(row.earnedCredits)}
        </div>
      )}

      {draft ? (
        <input
          value={draft.grade}
          maxLength={1}
          placeholder="—"
          aria-label={`Grade for ${row.courseCode}`}
          onChange={(event) =>
            setDraft({ ...draft, grade: event.target.value.toUpperCase() })
          }
          className="box-border h-7 w-[34px] rounded-[6px] border border-cc-brand text-center font-semibold text-[13px] text-cc-ink uppercase outline-none"
        />
      ) : (
        <div>
          <span className="inline-flex items-center rounded-[7px] bg-cc-pill px-[9px] py-[3px] font-semibold text-[13px] text-cc-brand">
            {row.grade ?? "—"}
          </span>
        </div>
      )}

      {draft ? (
        <input
          value={draft.year}
          inputMode="numeric"
          maxLength={4}
          placeholder="2025"
          aria-label={`Year for ${row.courseCode}`}
          onChange={(event) =>
            setDraft({
              ...draft,
              year: event.target.value.replace(/\D/g, "").slice(0, 4),
            })
          }
          className="box-border h-7 w-[58px] rounded-[6px] border border-cc-brand px-1.5 text-center text-[13px] text-cc-ink outline-none"
        />
      ) : (
        <div className="text-[13px] text-cc-ink2 tabular-nums">
          {row.attendanceYear ?? "—"}
        </div>
      )}

      <div className="flex min-w-0 items-center">
        {isReviewed === null ? (
          <span className="text-[11.5px] text-cc-dim2">—</span>
        ) : isReviewed ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-[12px] text-cc-success">
            <CircleCheck size={14} strokeWidth={2.1} aria-hidden />
            Done
          </span>
        ) : (
          <span className="text-[11.5px] text-cc-dim2">Not yet</span>
        )}
      </div>

      {draft ? (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={save}
            disabled={edits === null}
            title={
              edits === null
                ? "Credits and year have to be a number"
                : `Save ${row.courseCode}`
            }
            aria-label={`Save ${row.courseCode}`}
            className={`${ICON_BUTTON} border-transparent bg-cc-btn text-cc-btn-fg hover:opacity-[0.88]`}
          >
            <Check size={14} strokeWidth={2.2} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setDraft(null)}
            aria-label={`Cancel editing ${row.courseCode}`}
            className={`${ICON_BUTTON} hover:border-cc-hov`}
          >
            <X size={14} strokeWidth={2} aria-hidden />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={startEditing}
            disabled={isBusy}
            aria-label={`Edit credits, grade and year for ${row.courseCode}`}
            className={`${ICON_BUTTON} text-cc-brand hover:border-cc-brand`}
          >
            <Pencil size={14} strokeWidth={1.9} aria-hidden />
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={isBusy}
            aria-label={`Remove ${row.courseCode} from your taken courses`}
            className={`${ICON_BUTTON} text-cc-chip-ink hover:border-cc-danger`}
          >
            <Trash2 size={14} strokeWidth={1.9} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
