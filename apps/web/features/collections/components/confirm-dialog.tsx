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
 * ## Why this exists rather than `components/ui/alert-dialog`
 *
 * `Course Community - My Page.dc.html` lines 426-436 draw this dialog properly —
 * 440px, a 14px radius, 22px of padding, a brand eyebrow over a 19px/600 title,
 * an `rgba(20,30,45,.34)` scrim and 38px buttons. The stock shadcn
 * `AlertDialogContent` renders its own overlay with no way to restyle it and
 * hands its buttons to `Button`'s variants, so reaching the artboard through it
 * would mean editing the shared primitive for one screen's sake. #134's design
 * review recorded that the app's existing delete dialogs are the stock component
 * and that the artboard is not; this is the artboard, built on the same
 * `Dialog` primitive its sibling `NewCollectionDialog` already uses, so the two
 * modals in this feature are one object drawn twice rather than two.
 *
 * Everything the primitive gives is what a confirmation needs and markup alone
 * cannot: the focus trap, Escape, and focus returning to the control that
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
          showCloseButton={false}
          /*
            `cc-theme` because the dialog is portalled to the body and would
            otherwise leave the subtree that defines the `--cc-*` tokens.

            There used to be an `sm:max-w-[440px]` here too, to defeat an
            `sm:max-w-sm` the primitive carried in its own base classes — a plain
            `max-w-*` sits in a different tailwind-merge group and so did not
            replace it. #178 took that clamp out of the primitive, which is where
            the problem was, so the override is gone: `w-[440px]` now means
            440px, and `max-w-[calc(100vw-2rem)]` is the only thing narrowing it.
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
