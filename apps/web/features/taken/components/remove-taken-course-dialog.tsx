"use client";

import {
  ConfirmDialog,
  type ConfirmRequest,
} from "@/components/ui/confirm-dialog";
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
 * Confirming the removal of a taken course.
 *
 * The dialog itself is {@link ConfirmDialog} — this only decides what it asks.
 * Do not give it a shell of its own: the 440px frame, the scrim and the button
 * pair belong to the shared component, and the eyebrow and body are what
 * {@link ConfirmRequest} models.
 *
 * Two deliberate departures from
 * `docs/design_ref/2026-09-06/Course Community - My Page.dc.html`.
 *
 * **It confirms before the write, not after.** The artboard removes on the click
 * and offers a note; #155 settled that destructive actions confirm first, and of
 * the three that settled a taken course is the one worth the modal — everything
 * on the row is self-reported and a transcript re-read is the only cheap way
 * back.
 *
 * **The action button is `--cc-danger`, not the artboard's `#c96a4a`.** That hex
 * has exactly one token in this theme, `--cc-node-ember`, and it is the
 * community-graph palette — `server/graph/placement.ts` stores a colour *name*
 * and those six tokens are the client half of that contract. Painting a delete
 * button from it would make re-skinning the graph re-skin this dialog. The
 * destructive token is what every other destructive control in the app uses, and
 * it is now `ConfirmDialog`'s, not this file's, so the deviation is stated once.
 */
export function RemoveTakenCourseDialog({ row, onCancel, onConfirm }: Props) {
  return (
    <ConfirmDialog
      request={{
        eyebrow: "Taken courses",
        title: `Remove ${row.courseCode} from your courses?`,
        body: bodyFor(row),
        cancelLabel: "Keep course",
        actionLabel: "Remove course",
      }}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
