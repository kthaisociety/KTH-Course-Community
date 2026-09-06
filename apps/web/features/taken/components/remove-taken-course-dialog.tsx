"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TakenRow } from "../lib/taken-rows";

type Props = {
  /** The row being removed. Mounted per row, so it can name the course. */
  row: TakenRow;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * What removing this row actually costs the reader.
 *
 * Two answers, because there are two rows. Everything on either is
 * self-reported — `user_taken_courses` stores a code plus a grade, credits,
 * periods and year the student typed — but only a hand-entered row can be put
 * back by the note that follows. Putting an imported row back would go through
 * `taken.add`, which writes no `transcript_imported_at`, so the course would
 * return quietly re-labelled as hand-entered and nothing in the API can set
 * that column again. The dialog says so before the click rather than leaving
 * the reader to notice the missing Undo afterwards.
 */
function bodyFor(row: TakenRow): string {
  return row.transcriptImportedAt
    ? `The grade, credits and year on this row are your own entries and go with it. This one was read from a transcript, so there is no putting it back in a tap — you would add ${row.courseCode} by hand, or read the transcript again.`
    : `The grade, credits and year on this row are your own entries and go with it. Nothing anyone else sees changes, and the note that follows offers one tap to put ${row.courseCode} back.`;
}

/**
 * Confirming the removal of a taken course —
 * `docs/design_ref/2026-09-06/Course Community - My Page.dc.html:426-438`, which
 * is where this design lives: a 440px panel at 14px radius and 22px padding,
 * a brand eyebrow over a 19px/600 title, a 13.5px body, and two 38px buttons
 * ranged right over an `rgba(20,30,45,.34)` scrim.
 *
 * Two deliberate departures from that artboard, both recorded on the PR.
 *
 * **It confirms before the write, not after.** The artboard removes on the
 * click and offers a note; #155 settled that destructive actions confirm first,
 * and of the three that settled a taken course is the one worth the modal —
 * everything on the row is self-reported and a transcript re-read is the only
 * cheap way back.
 *
 * **The action button is `--cc-danger`, not the artboard's `#c96a4a`.** That
 * hex has exactly one token in this theme, `--cc-node-ember`, and it is the
 * community-graph palette — `server/graph/placement.ts` stores a colour *name*
 * and those six tokens are the client half of that contract. Painting a delete
 * button from it would make re-skinning the graph re-skin this dialog. The
 * destructive token is what every other destructive control in the app uses.
 *
 * Built on `Dialog` rather than `AlertDialog` because the artboard's scrim is a
 * flat wash and only `DialogContent` takes an `overlayClassName`; the stock
 * alert overlay is a blurred `bg-black/10` with no way through to it. The
 * pattern is the transcript dialog's next door.
 */
export function RemoveTakenCourseDialog({ row, onCancel, onConfirm }: Props) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="cc-theme w-[440px] max-w-[calc(100vw-2rem)] gap-0 rounded-[14px] bg-cc-surface p-[22px] text-cc-ink shadow-[0_18px_48px_rgba(20,30,45,0.24)] ring-0"
      >
        <p className="m-0 font-semibold text-[11px] text-cc-brand uppercase tracking-[0.06em]">
          Taken courses
        </p>
        <DialogTitle className="mt-2 font-semibold text-[19px] leading-[1.3]">
          Remove {row.courseCode} from your courses?
        </DialogTitle>
        <DialogDescription className="mt-[9px] text-[13.5px] text-cc-muted leading-[1.55]">
          {bodyFor(row)}
        </DialogDescription>

        <div className="mt-[18px] flex justify-end gap-[9px]">
          {/*
            Ranged right with the safe choice first, which is also the one
            Radix moves focus to on open: Enter on an unread dialog keeps the
            course.
          */}
          <button
            type="button"
            onClick={onCancel}
            className="flex h-[38px] cursor-pointer items-center rounded-[9px] border border-cc-rule3 bg-cc-surface px-3.5 font-medium text-[13px] text-cc-chip-ink hover:border-cc-hov"
          >
            Keep course
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex h-[38px] cursor-pointer items-center rounded-[9px] bg-cc-danger px-4 font-semibold text-[13px] text-cc-danger-fg hover:opacity-[0.88]"
          >
            Remove course
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
