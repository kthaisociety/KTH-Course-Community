"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * What one confirmation asks. Held as a single object so the caller's pending
 * state is one value rather than a flag plus the subject it is about — the
 * dialog is open exactly when there is something to ask about.
 */
export type ConfirmRequest = {
  /** The section this belongs to, in the artboard's small uppercase brand line. */
  eyebrow: string;
  /** The question, asked as a question. */
  title: string;
  /** What confirming actually does, and what it does not touch. */
  body: string;
  /** Names the thing being kept, never the word "Cancel" alone. */
  cancelLabel: string;
  /** Names the destruction, so the button and the title agree. */
  actionLabel: string;
};

type Props = {
  /** `null` closes it. See {@link ConfirmRequest} for why that is the whole state. */
  request: ConfirmRequest | null;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * The confirmation that stands in front of something that cannot be taken back.
 *
 * ## Why it lives here
 *
 * Seven screens ask a confirmation, and they differ only in the eyebrow and the
 * body — which is what {@link ConfirmRequest} models. So the shell is one
 * component. It is not a vendored shadcn primitive and does not pretend to be
 * one; it is app UI that more than one feature needs and no single feature
 * owns, which is the case `components/ui/` exists for.
 *
 * A wrapper like `RemoveTakenCourseDialog` is still worth having where it
 * decides *what* to ask. It is the duplicated shell that must not come back.
 *
 * ## Why this exists rather than `components/ui/alert-dialog`
 *
 * `Course Community - My Page.dc.html` draws this dialog properly —
 * 440px, a 14px radius, 22px of padding, a brand eyebrow over a 19px/600 title,
 * an `rgba(20,30,45,.34)` scrim and 38px buttons. The stock `AlertDialogContent`
 * hands its buttons to `Button`'s variants and clamps its own width:
 * `data-[size=default]:sm:max-w-sm` sits in a different tailwind-merge group
 * from a plain `max-w-*`, so a caller asking for 440px silently gets 384px from
 * the `sm` breakpoint up. `DialogContent` no longer carries that clamp;
 * `AlertDialogContent` still does.
 *
 * So the shell is `Dialog`, and the semantics are restored by hand:
 * `role="alertdialog"` is what tells a screen reader this is a question that
 * interrupts, and Radix spreads it onto the content element over its own
 * `role="dialog"`. `DialogTitle` and `DialogDescription` supply the
 * `aria-labelledby` and `aria-describedby` that role expects. The one thing not
 * recovered is `AlertDialog`'s refusal to close on an outside click — noted, and
 * not worth a second primitive, because the outside click cancels rather than
 * confirms and Escape already does the same thing.
 *
 * Everything else the primitive gives is what a confirmation needs and markup
 * alone cannot: the focus trap, Escape, and focus returning to the control that
 * opened it. Cancel is first in the DOM, so it is what opens focused — the safe
 * half of a destructive question should be the one a stray Enter hits.
 *
 * ## Why confirming, rather than undoing afterwards
 *
 * This is a deliberate, authorised deviation from the artboards that ask *after*
 * — see #155. Deleting a collection cannot be undone by replaying the public
 * procedures: `reorderCollectionCourses` throws on a code that is not already a
 * member, so `create` + `reorder` restores nothing, and `addCourseToCollection`
 * throws `ForbiddenError` for a course that has since been unsaved. A restore
 * that can come back partial is not an undo, so the question is asked while the
 * answer still costs nothing.
 */
export function ConfirmDialog({ request, onCancel, onConfirm }: Props) {
  return (
    <Dialog
      open={request !== null}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      {request ? (
        <DialogContent
          role="alertdialog"
          showCloseButton={false}
          /*
            `cc-theme` because the dialog is portalled to the body and would
            otherwise leave the subtree that defines the `--cc-*` tokens.

            No `sm:max-w-*` here, and none needed: `DialogContent` carries no
            width of its own beyond the phone guard, so `w-[440px]` means 440px
            and `max-w-[calc(100vw-2rem)]` is the only thing narrowing it. If a
            responsive clamp ever comes back to the primitive, a plain `max-w-*`
            here will not defeat it — tailwind-merge keeps the two in different
            groups.
          */
          className="cc-theme w-[440px] max-w-[calc(100vw-2rem)] gap-0 rounded-[14px] bg-cc-surface p-[22px] text-cc-ink shadow-[0_18px_48px_rgba(20,30,45,0.24)] ring-0"
        >
          <div className="font-semibold text-[11px] text-cc-brand uppercase tracking-[0.06em]">
            {request.eyebrow}
          </div>
          <DialogTitle className="mt-2 font-semibold text-[19px] leading-[1.3]">
            {request.title}
          </DialogTitle>
          <DialogDescription className="mt-[9px] text-[13.5px] text-cc-muted leading-[1.55]">
            {request.body}
          </DialogDescription>

          <div className="mt-[18px] flex justify-end gap-[9px]">
            <button
              type="button"
              onClick={onCancel}
              className="flex h-[38px] cursor-pointer items-center rounded-[9px] border border-cc-rule3 bg-cc-surface px-3.5 font-medium text-[13px] text-cc-chip-ink hover:border-cc-hov"
            >
              {request.cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex h-[38px] cursor-pointer items-center rounded-[9px] bg-cc-danger px-4 font-semibold text-[13px] text-cc-danger-fg hover:opacity-[0.88]"
            >
              {request.actionLabel}
            </button>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
