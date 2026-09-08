"use client";

import { useState } from "react";
import { ReviewCard } from "@/features/reviews";
import type { Review } from "@/types";
import { ExpandedReview } from "./expanded-review";

type Props = {
  heading: string;
  reviews: Review[];
  emptyTitle: string;
  emptyBody: string;
  /** The empty panel's call to action, where the column has one to offer. */
  emptyAction?: { label: string; onClick: () => void };
  /**
   * Which of this column's reviews is unfolded, and how to say that another one
   * should be.
   *
   * Given together only for the column of the viewer's own reviews, whose cards
   * open into {@link ExpandedReview} rather than into the card's own read-back
   * blocks. Which id is open is held above this column rather than in it: one
   * review is open at a time across the tab, and the tab is what knows that.
   */
  openReviewId?: string | null;
  onOpenReviewChange?: (id: string | null) => void;
  /**
   * Delete the review the expanded card's footer is offering to delete. My Page
   * owns the confirmation, because a dialog belongs to the page rather than to
   * a card inside a list on it.
   */
  onDeleteReview?: (review: Review) => void;
};

/**
 * One of the Reviews tab's two columns — the artboard's `isMine` branch, which
 * draws the same list twice either side of a rule.
 *
 * A card unfolds where it stands, inside the half-column it is already in, and
 * the other column stays beside it while it is open. The viewer's own reviews
 * unfold into {@link ExpandedReview} — the course above the review and a footer
 * that edits or deletes it; the reviews they upvoted unfold into the card's own
 * read-back blocks, because there is nothing on someone else's review to offer
 * them. ADR 0010 records why the review no longer takes the whole tab, and what
 * the column's width costs the examination bar.
 *
 * No vote controls. Voting happens where the review lives, on the course page:
 * `reviews.vote` invalidates that course's list, and this page reads the
 * unfiltered one, so a vote cast here would leave the column it came from
 * showing a stale score. The cards still show the net score, which is what the
 * artboard puts in the column too.
 */
export function ReviewColumn({
  heading,
  reviews,
  emptyTitle,
  emptyBody,
  emptyAction,
  openReviewId,
  onOpenReviewChange,
  onDeleteReview,
}: Props) {
  /**
   * Whether the open card is part-way through a rewrite.
   *
   * A column-wide flag rather than one per card, because only one card is open
   * and so only one can be editing. It exists to stop a click on the summary
   * from discarding an edit; deliberately opening a *different* review still
   * does, which is a choice the reader made rather than a stray click.
   */
  const [editing, setEditing] = useState(false);
  const expandable = onOpenReviewChange !== undefined;
  return (
    <section>
      <h2 className="m-0 mb-2.5 font-semibold text-[12px] text-cc-dim uppercase tracking-[0.05em]">
        {heading}
      </h2>
      {reviews.length === 0 ? (
        <div className="rounded-[12px] border border-cc-rule3 border-dashed bg-cc-surface px-5 py-11 text-center">
          <div className="font-semibold text-[16px]">{emptyTitle}</div>
          <p className="mx-auto mt-[7px] max-w-[420px] text-[13px] text-cc-muted leading-[1.5]">
            {emptyBody}
          </p>
          {emptyAction ? (
            <button
              type="button"
              onClick={emptyAction.onClick}
              className="mt-4 inline-flex h-10 cursor-pointer items-center rounded-[9px] bg-cc-btn px-[17px] font-semibold text-[13.5px] text-cc-btn-fg hover:opacity-[.88]"
            >
              {emptyAction.label}
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
          {reviews.map((review) => {
            const open = expandable ? openReviewId === review.id : undefined;
            return (
              <li key={review.id}>
                <ReviewCard
                  review={review}
                  expanded={open}
                  onExpandedChange={
                    onOpenReviewChange === undefined
                      ? undefined
                      : (next) => {
                          // Never fold a rewrite away by accident.
                          if (!next && editing) return;
                          setEditing(false);
                          onOpenReviewChange(next ? review.id : null);
                        }
                  }
                  expandedSlot={
                    open ? (
                      <ExpandedReview
                        review={review}
                        onDelete={() => onDeleteReview?.(review)}
                        onEditingChange={setEditing}
                      />
                    ) : undefined
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
