"use client";

import { ReviewCard } from "@/features/reviews";
import type { Review } from "@/types";

type Props = {
  heading: string;
  reviews: Review[];
  emptyTitle: string;
  emptyBody: string;
  /** The empty panel's call to action, where the column has one to offer. */
  emptyAction?: { label: string; onClick: () => void };
  /**
   * Open one review on its own, which the artboard's `isDetail` branch does
   * with the whole tab. Given only for the column of the viewer's own reviews:
   * the detail's footer offers Edit review and Delete review, and there is
   * nothing on the other column's reviews to offer.
   */
  onOpen?: (review: Review) => void;
};

/**
 * One of the Reviews tab's two columns — the artboard's `isMine` branch, which
 * draws the same list twice either side of a rule.
 *
 * The cards are summaries here and nothing more. A card given an `onOpen` does
 * not unfold in place — half a column is a poor width for an examination bar,
 * and the artboard opens a review into a panel of its own instead.
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
  onOpen,
}: Props) {
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
          {reviews.map((review) => (
            <li key={review.id}>
              <ReviewCard
                review={review}
                onOpen={onOpen ? () => onOpen(review) : undefined}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
