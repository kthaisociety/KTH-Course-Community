"use client";

import parse from "html-react-parser";
import { ArrowDown, ArrowUp, CircleCheck, CircleX, Pencil } from "lucide-react";
import { useId, useState } from "react";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { cn } from "@/lib/utils";
import type { Review, ReviewVoteType } from "@/types";
import { toExcerpt } from "../lib/review-text";
import { ExaminationBlock, ProfileBlock } from "./review-detail-blocks";

export type ReviewCardProps = {
  review: Review;
  /**
   * Whether the viewer wrote this review, which is the only reason to offer
   * editing or deleting. Hiding the controls is courtesy, not the security
   * boundary: `reviews.update` and `reviews.delete` check authorship on the
   * server and would refuse anyone else regardless of what is rendered.
   */
  isAuthor?: boolean;
  /**
   * Omitted for visitors, who may read reviews but not vote on them. The score
   * still shows; the buttons do not, so there is nothing to click that cannot
   * work.
   */
  onVote?: (voteType: ReviewVoteType) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  /**
   * Open this review somewhere of the caller's choosing, instead of expanding
   * it in place.
   *
   * My Page passes it: its artboard opens a review into a detail of its own
   * rather than unfolding it inside a column half the width. Given one, the
   * card never expands and never draws the author's buttons — the detail's
   * footer is where they live there.
   */
  onOpen?: () => void;
};

/**
 * One review, as the Review Card artboard draws it: a coloured left edge for
 * whether the reviewer was happy they took the course, the message leading, a
 * course-code meta line, and an upvote/downvote pair with the net score.
 * Reviews are anonymous, so no name and no signature appear anywhere.
 *
 * Clicking the summary opens the rest — the scores, the examination split and
 * the theory/applied split, in the very blocks the design's review detail is
 * built from. Everything the reviewer left unanswered says so in words; nothing
 * unanswered is drawn as a zero.
 *
 * `onOpen` replaces that: a caller with somewhere better to put a review takes
 * the click and the card stays a summary.
 *
 * Presentational: it takes a `Review` and callbacks, and the screen maps tRPC
 * output and mutations onto them.
 */
export function ReviewCard({
  review,
  isAuthor = false,
  onVote,
  onEdit,
  onDelete,
  onOpen,
}: Readonly<ReviewCardProps>) {
  const [expanded, setExpanded] = useState(false);
  const detailId = useId();
  const opensInPlace = onOpen === undefined;

  const { happyTook } = review;
  // The revised card uses the review-warning accent for an unhappy verdict;
  // danger ink remains reserved for destructive actions such as downvoting.
  const accent = happyTook ? "var(--cc-success)" : "var(--cc-warn-btn)";
  const excerpt = toExcerpt(review.message);
  const netScore = review.upvoteCount - review.downvoteCount;
  const isUpvoted = review.userVote === "up";
  const isDownvoted = review.userVote === "down";

  return (
    <article
      className="rounded-[12px] border border-cc-rule border-l-[3px] bg-cc-surface px-4 pt-4 pb-3 transition-colors hover:border-cc-hov"
      style={{ borderLeftColor: accent }}
    >
      <button
        type="button"
        className="block w-full cursor-pointer text-left"
        aria-expanded={opensInPlace ? expanded : undefined}
        aria-controls={opensInPlace ? detailId : undefined}
        onClick={onOpen ?? (() => setExpanded((open) => !open))}
      >
        <div
          className={cn(
            "flex items-center gap-[5px] font-semibold text-[11px]",
            happyTook ? "text-cc-success-ink" : "text-cc-danger-ink",
          )}
        >
          {happyTook ? (
            <CircleCheck className="size-[11px] flex-none" strokeWidth={2.6} />
          ) : (
            <CircleX className="size-[11px] flex-none" strokeWidth={2.6} />
          )}
          {happyTook ? "Happy they took it" : "Not really"}
        </div>
        {excerpt ? (
          <div className="mt-[9px] text-[13.5px] text-cc-ink leading-[1.5]">
            {excerpt}
          </div>
        ) : (
          <div className="mt-[9px] text-[13.5px] text-cc-dim italic leading-[1.5]">
            Scores only — this reviewer wrote nothing.
          </div>
        )}
      </button>

      <div className="mt-[11px] flex items-center justify-between gap-2.5 text-[11.5px] text-cc-dim2">
        <span>{review.courseCode}</span>
        <div className="flex items-center overflow-hidden rounded-lg border border-cc-rule">
          {onVote ? (
            <>
              <button
                type="button"
                title="Helpful"
                aria-label="Upvote this review"
                aria-pressed={isUpvoted}
                className="flex h-[22px] w-6 cursor-pointer items-center justify-center transition-transform"
                style={{
                  color: isUpvoted ? "var(--cc-brand)" : "var(--cc-dim)",
                  transform: isUpvoted ? "scale(1.2)" : undefined,
                }}
                onClick={() => onVote("up")}
              >
                <ArrowUp
                  className={cn("size-3", isUpvoted && "fill-current")}
                  strokeWidth={2.3}
                />
              </button>
              <span className="min-w-5 text-center font-bold text-[11px] text-cc-ink2 tabular-nums">
                <span className="sr-only">Net score: </span>
                {netScore}
              </span>
              <button
                type="button"
                title="Not helpful"
                aria-label="Downvote this review"
                aria-pressed={isDownvoted}
                className="flex h-[22px] w-6 cursor-pointer items-center justify-center transition-transform"
                style={{
                  color: isDownvoted ? "var(--cc-danger-ink)" : "var(--cc-dim)",
                  transform: isDownvoted ? "scale(1.2)" : undefined,
                }}
                onClick={() => onVote("down")}
              >
                <ArrowDown
                  className={cn("size-3", isDownvoted && "fill-current")}
                  strokeWidth={2.3}
                />
              </button>
            </>
          ) : (
            <span
              className="px-1.5 font-bold text-[11px] text-cc-ink2 tabular-nums leading-[22px]"
              title="Sign in to vote on reviews"
            >
              <span className="sr-only">Net score: </span>
              {netScore}
            </span>
          )}
        </div>
      </div>

      {opensInPlace && expanded ? (
        <div id={detailId} className="mt-3.5 flex flex-col gap-3.5">
          <div className="rounded-[12px] border border-cc-rule bg-cc-pg px-4 pt-[15px] pb-3.5">
            <ExaminationBlock
              examinationDistribution={review.examinationDistribution}
              approachTheoryPercent={review.approachTheoryPercent}
            />
          </div>

          <div className="flex flex-col gap-3.5 rounded-[12px] border border-cc-rule bg-cc-pg px-4 pt-[15px] pb-3.5">
            <ProfileBlock
              workloadScore={review.workloadScore}
              learningScore={review.learningScore}
            />
          </div>

          {review.message ? (
            <div className="prose prose-sm max-w-none rounded-[12px] border border-cc-rule bg-cc-pg px-4 pt-[15px] pb-3.5 text-[14px] text-cc-ink2 leading-[1.6]">
              {parse(sanitizeHtml(review.message))}
            </div>
          ) : null}

          {isAuthor && (onEdit || onDelete) ? (
            <div className="flex justify-end gap-[9px]">
              {onDelete ? (
                <button
                  type="button"
                  className="flex h-[38px] cursor-pointer items-center rounded-[9px] border border-cc-rule3 bg-cc-surface px-3.5 font-medium text-[13px] text-cc-chip-ink transition-colors hover:border-cc-danger hover:text-cc-danger"
                  onClick={onDelete}
                >
                  Delete review
                </button>
              ) : null}
              {onEdit ? (
                <button
                  type="button"
                  className="flex h-[38px] cursor-pointer items-center gap-2 rounded-[9px] bg-cc-btn px-4 font-semibold text-[13px] text-cc-btn-fg"
                  onClick={onEdit}
                >
                  <Pencil className="size-[15px]" strokeWidth={1.9} />
                  Edit review
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
