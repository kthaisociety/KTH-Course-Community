"use client";

import parse from "html-react-parser";
import { ArrowDown, ArrowUp, CircleCheck, CircleX, Pencil } from "lucide-react";
import { useId, useState } from "react";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { cn } from "@/lib/utils";
import type { Review, ReviewVoteType } from "@/types";
import { MAX_REVIEW_SCORE } from "@/types";
import {
  examinationSegments,
  examinationSplitLabel,
} from "../lib/examination-palette";
import { toExcerpt } from "../lib/review-text";

/**
 * What a reviewer who answered "I don't remember" gets drawn in place of a
 * chart. Copy from the review detail in
 * `docs/design_ref_new/Course Community - My Page.dc.html`, with its "student"
 * changed to the reviewer, who is the one person the sentence is actually
 * about.
 */
const UNANSWERED_NOTE =
  "The reviewer chose “I don't remember” — nothing is estimated in its place.";

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
};

/** The dashed panel that stands in for a chart nobody answered. */
function UnansweredPanel() {
  return (
    <div className="mt-[11px] flex h-[38px] items-center rounded-lg border border-cc-rule3 border-dashed bg-cc-surface px-[13px] text-[12.5px] text-cc-dim">
      {UNANSWERED_NOTE}
    </div>
  );
}

type SectionHeadProps = {
  title: string;
  /** The pill beside the heading; "Not recorded" when there is no answer. */
  value: string;
  className?: string;
};

/** A detail block's heading and the figure that goes with it. */
function SectionHead({ title, value, className }: Readonly<SectionHeadProps>) {
  return (
    <div
      className={cn("flex items-baseline justify-between gap-2.5", className)}
    >
      <div className="font-semibold text-[14.5px]">{title}</div>
      <div className="flex-none rounded-full bg-cc-pill px-[9px] py-0.5 font-semibold text-[12px] text-cc-brand tabular-nums">
        {value}
      </div>
    </div>
  );
}

type MeterProps = {
  label: string;
  score: number;
  low: string;
  high: string;
};

/**
 * One 1-10 axis. Scores are displayed raw — a 7 is "7 / 10" and fills 70% of
 * the track. Nothing is rescaled to five (issue #68, decision 2).
 */
function Meter({ label, score, low, high }: Readonly<MeterProps>) {
  return (
    <div>
      <SectionHead
        title={label}
        value={`${score} / ${MAX_REVIEW_SCORE}`}
        className="mb-[9px]"
      />
      <div className="h-2 w-full overflow-hidden rounded-[4px] bg-cc-rule">
        <div
          className="h-full bg-cc-btn"
          style={{ width: `${(score / MAX_REVIEW_SCORE) * 100}%` }}
        />
      </div>
      <div className="mt-[5px] flex justify-between text-[11.5px] text-cc-muted">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

/**
 * One review, as the Review Card artboard draws it: a coloured left edge for
 * whether the reviewer was happy they took the course, the message leading, a
 * course-code meta line, and an upvote/downvote pair with the net score.
 * Reviews are anonymous, so no name and no signature appear anywhere.
 *
 * Clicking the summary opens the rest — the scores, the examination split and
 * the theory/applied split, drawn in the same language the design's review
 * detail uses. Everything the reviewer left unanswered says so in words;
 * nothing unanswered is drawn as a zero.
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
}: Readonly<ReviewCardProps>) {
  const [expanded, setExpanded] = useState(false);
  const detailId = useId();

  const { happyTook } = review;
  // The revised card uses the review-warning accent for an unhappy verdict;
  // danger ink remains reserved for destructive actions such as downvoting.
  const accent = happyTook ? "var(--cc-success)" : "var(--cc-warn-btn)";
  const excerpt = toExcerpt(review.message);
  const netScore = review.upvoteCount - review.downvoteCount;
  const isUpvoted = review.userVote === "up";
  const isDownvoted = review.userVote === "down";
  const segments = examinationSegments(review.examinationDistribution);
  const splitLabel = examinationSplitLabel(review.examinationDistribution);
  const theoryPercent = review.approachTheoryPercent;

  return (
    <article
      className="rounded-xl border border-cc-rule border-l-[3px] bg-cc-surface px-4 pt-4 pb-3 transition-colors hover:border-cc-hov"
      style={{ borderLeftColor: accent }}
    >
      <button
        type="button"
        className="block w-full cursor-pointer text-left"
        aria-expanded={expanded}
        aria-controls={detailId}
        onClick={() => setExpanded((open) => !open)}
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

      {expanded ? (
        <div id={detailId} className="mt-3.5 flex flex-col gap-3.5">
          <div className="rounded-xl border border-cc-rule bg-cc-pg px-4 pt-[15px] pb-3.5">
            <div className="font-semibold text-[10.5px] text-cc-dim uppercase tracking-[0.09em]">
              Format
            </div>
            <SectionHead
              title="How it was examined"
              value={splitLabel ?? "Not recorded"}
              className="mt-1.5"
            />
            {segments.length > 0 ? (
              <div className="mt-[11px] flex h-[38px] overflow-hidden rounded-lg bg-cc-rule">
                {segments.map((segment) => (
                  <div
                    key={segment.key}
                    className="flex items-center justify-center overflow-hidden whitespace-nowrap font-semibold text-[12px]"
                    style={{
                      width: `${segment.percent}%`,
                      background: segment.color,
                      color: segment.ink,
                    }}
                  >
                    {segment.label}
                  </div>
                ))}
              </div>
            ) : (
              <UnansweredPanel />
            )}

            <div className="my-3.5 h-px bg-cc-rule" />

            <SectionHead
              title="The approach"
              value={
                theoryPercent === null
                  ? "Not recorded"
                  : `${theoryPercent} / ${100 - theoryPercent}`
              }
            />
            {theoryPercent === null ? (
              <UnansweredPanel />
            ) : (
              <div className="mt-[11px] flex h-[38px] overflow-hidden rounded-lg bg-cc-rule">
                <div
                  className="flex items-center overflow-hidden whitespace-nowrap bg-cc-btn pl-[11px] font-semibold text-[12px] text-cc-btn-fg"
                  style={{ width: `${theoryPercent}%` }}
                >
                  Theoretical
                </div>
                <div
                  className="flex items-center justify-end overflow-hidden whitespace-nowrap bg-cc-info pr-[11px] font-semibold text-[12px] text-cc-brand"
                  style={{ width: `${100 - theoryPercent}%` }}
                >
                  Applied
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3.5 rounded-xl border border-cc-rule bg-cc-pg px-4 pt-[15px] pb-3.5">
            <div className="font-semibold text-[10.5px] text-cc-dim uppercase tracking-[0.09em]">
              Course profile
            </div>
            <Meter
              label="How demanding it was"
              score={review.workloadScore}
              low="Not at all"
              high="Very"
            />
            <Meter
              label="How much was learned"
              score={review.learningScore}
              low="Nothing new"
              high="Transformative"
            />
          </div>

          {review.message ? (
            <div className="prose prose-sm max-w-none rounded-xl border border-cc-rule bg-cc-pg px-4 pt-[15px] pb-3.5 text-[14px] text-cc-ink2 leading-[1.6]">
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
