"use client";

import { useCallback, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useCourseDetails, useCourseSummaries } from "@/features/courses";
import {
  examinationSegments,
  ReviewList,
  useReviewList,
} from "@/features/reviews";
import { formatHp, kthCourseUrl } from "@/lib/kth";
import { sanitizeCourseHtml } from "@/lib/sanitize-html";
import { cn } from "@/lib/utils";
import type { CourseReviewStats } from "@/types";
import { EXAMINATION_DISTRIBUTION_LABELS, MAX_REVIEW_SCORE } from "@/types";
import { APPLIED_FILL, Kicker } from "./pane-parts";

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-[11.5px] text-cc-ink">
      <span>{label}</span>
      <span className="flex-none whitespace-nowrap rounded-full bg-cc-pill px-2 py-0.5 font-semibold text-[11px] text-cc-dim tabular-nums">
        {value}
      </span>
    </div>
  );
}

/** A 1–10 mean, drawn raw: a course averaging 7.6 reads "7.6 / 10". */
function ScoreBar({
  label,
  mean,
  fill,
}: {
  label: string;
  mean: number;
  fill: string;
}) {
  return (
    <div>
      <Figure
        label={label}
        value={`${mean.toFixed(1)} / ${MAX_REVIEW_SCORE}`}
      />
      <div className="mt-[7px] h-1.5 overflow-hidden rounded-[3px] bg-cc-pill">
        <div
          className="h-full"
          style={{
            width: `${(mean / MAX_REVIEW_SCORE) * 100}%`,
            background: fill,
          }}
        />
      </div>
    </div>
  );
}

function ReviewsSummary({
  stats,
  onReadReviews,
}: {
  stats: CourseReviewStats;
  onReadReviews: () => void;
}) {
  // The same slices the Review Card draws, from the reviews feature's own
  // palette — one examination bar in the app, not two that drift apart.
  const shares = examinationSegments(stats.examinationDistribution);
  const theory = stats.approachTheoryPercent;

  return (
    <div className="rounded-[12px] border border-cc-rule bg-cc-pg p-4">
      <div className="grid items-stretch gap-[30px] @md:grid-cols-[1fr_0.82fr]">
        <div>
          <Kicker>Reviews summary</Kicker>
          <div className="mt-[5px] mb-3.5 font-semibold text-[14.5px]">
            What students report
          </div>

          <Figure
            label="Examination"
            value={
              shares.length > 0
                ? shares.map((share) => share.percent).join(" / ")
                : "—"
            }
          />
          <div className="mt-[7px] flex h-3.5 overflow-hidden rounded-[4px] bg-cc-pill">
            {shares.map((share) => (
              <div
                key={share.key}
                style={{ width: `${share.percent}%`, background: share.color }}
              />
            ))}
          </div>
          <div className="mt-1.5 text-[11px] text-cc-dim">
            {shares.length > 0
              ? shares
                  .map((share) => EXAMINATION_DISTRIBUTION_LABELS[share.key])
                  .join(" · ")
              : "No examination breakdown yet"}
          </div>

          <div className="mt-[18px]">
            <Figure
              label="Approach"
              value={theory === null ? "—" : `${theory} / ${100 - theory}`}
            />
            <div className="mt-[7px] flex h-1.5 overflow-hidden rounded-[3px] bg-cc-pill">
              <div
                style={{
                  width: `${theory ?? 0}%`,
                  background: "var(--cc-btn)",
                }}
              />
              <div
                style={{
                  width: `${theory === null ? 0 : 100 - theory}%`,
                  background: APPLIED_FILL,
                }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-cc-dim">
              <span>Theoretical</span>
              <span>Applied</span>
            </div>
          </div>

          <div className="my-[18px] h-px bg-cc-pill" />

          <ScoreBar
            label="Workload"
            mean={stats.workloadMean}
            fill="var(--cc-score-workload)"
          />
          <div className="mt-[18px]">
            <ScoreBar
              label="Learning experience"
              mean={stats.learningMean}
              fill="var(--cc-btn)"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2.5 self-center rounded-[11px] border border-cc-rule bg-cc-surface/55 px-[17px] py-4">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--cc-warn-ink)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="self-center"
          >
            <title>Reviews</title>
            <path d="M12 3l1.7 4.8L18.5 9.5l-4.8 1.7L12 16l-1.7-4.8L5.5 9.5l4.8-1.7L12 3z" />
            <path d="M18.6 15.4l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z" />
          </svg>
          <button
            type="button"
            onClick={onReadReviews}
            className="text-left font-semibold text-[11.5px] text-cc-dim hover:underline"
          >
            Read all {stats.reviewCount} reviews →
          </button>
        </div>
      </div>
    </div>
  );
}

export interface CourseDetailsPanelProps {
  courseCode: string;
  /** Opens a review draft for this course in its own tab. */
  onWriteReview: () => void;
}

/**
 * One open course, read: what KOPPS says about it and what its reviewers said.
 *
 * The catalogue half comes from `course.details` and the numbers from
 * `course.summary`'s stats, which is `null` for a course nobody has reviewed —
 * that is a different thing from a course that scored nothing, and it is what
 * decides between the summary and "No reviews yet".
 */
export function CourseDetailsPanel({
  courseCode,
  onWriteReview,
}: Readonly<CourseDetailsPanelProps>) {
  const [contentOpen, setContentOpen] = useState(false);
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const reviewsHeadingRef = useRef<HTMLDivElement>(null);

  /**
   * "Read all N reviews" opens the list further down the pane, which is often
   * below the fold — so the pane scrolls to it, as the artboard's own
   * `revealReviews` does. Deferred a frame so the list is laid out first.
   */
  const revealReviews = useCallback(() => {
    setReviewsOpen(true);
    requestAnimationFrame(() => {
      reviewsHeadingRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, []);

  const details = useCourseDetails(courseCode);
  const [summary] = useCourseSummaries([courseCode]);
  const reviews = useReviewList(reviewsOpen ? courseCode : undefined);

  const course = details.data;
  /**
   * "Nobody has reviewed this" is `stats.reviews === null` on a summary that
   * came back — a different thing from a summary that has not arrived. The
   * two queries resolve independently, so collapsing them would tell a
   * reader a well-reviewed course has no reviews for as long as the second
   * request is in flight, and for good if it fails.
   */
  const statsAnswered = summary?.isSuccess === true;
  const statsFailed = summary?.isError === true;
  const stats = summary?.data?.stats.reviews ?? null;

  if (details.isLoading || !course) {
    return (
      <div className="flex flex-col gap-3 p-5">
        {details.error ? (
          <p className="text-[13px] text-cc-danger">
            Could not load {courseCode}. Try again.
          </p>
        ) : (
          <>
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-24 w-full" />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="@container">
      {/* The solid tint, not the `--cc-info` wash: on mobile this header is
          what tints the sheet a course opens into, and two stacked sheets in a
          low-alpha wash cannot be told apart. Details blue, review draft
          amber — the distinction that survives when the tab strip is hidden. */}
      <div className="border-cc-rule border-b bg-cc-info-solid px-5 pt-[18px] pb-[15px]">
        <div className="font-semibold text-[11px] text-cc-brand uppercase tracking-[0.06em]">
          Course details
        </div>
        <h2 className="mt-1.5 font-semibold text-[19px] leading-[1.2]">
          {course.titleEng}
        </h2>
        <p className="mt-[3px] text-[13px] text-cc-muted">
          {formatHp(course.credits)} hp · {course.courseCode}
          {course.department ? ` · ${course.department}` : ""}
        </p>
        <div className="mt-3 flex gap-2">
          <a
            href={kthCourseUrl(course.courseCode)}
            target="_blank"
            rel="noreferrer"
            className="flex h-[34px] items-center gap-[7px] whitespace-nowrap rounded-[8px] border border-cc-rule3 bg-cc-surface px-3 text-[13px] text-cc-chip-ink hover:border-cc-hov"
          >
            Open on KTH.se ↗
          </a>
        </div>
        <div className="mt-3.5 border-cc-rule border-t pt-3">
          <Kicker>Offerings</Kicker>
          <div className="mt-[7px] flex flex-col gap-[5px] text-[13px] text-cc-muted">
            {course.rounds.length === 0 ? (
              <div className="text-cc-dim2">No offering on file.</div>
            ) : (
              course.rounds.map((round, index) => (
                <div
                  key={`${round.startTerm}-${round.formattedPeriodsAndCredits ?? index}`}
                >
                  <span className="font-semibold text-cc-ink">
                    {round.formattedPeriodsAndCredits ?? "—"}
                  </span>{" "}
                  · {round.language ?? "—"} · {round.tutoringForm ?? "—"}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3.5 bg-cc-surface px-5 pt-4 pb-5">
        <div className="rounded-[12px] border border-cc-rule bg-cc-pg p-4">
          <Kicker>Content</Kicker>
          {course.content ? (
            <>
              <div
                className={cn(
                  "mt-[9px] text-[14px] text-cc-ink2 leading-[1.6] [&_p]:m-0",
                  !contentOpen && "line-clamp-3",
                )}
                // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized HTML
                dangerouslySetInnerHTML={{
                  __html: sanitizeCourseHtml(course.content),
                }}
              />
              <button
                type="button"
                onClick={() => setContentOpen((open) => !open)}
                aria-expanded={contentOpen}
                className="mt-[7px] font-medium text-[13px] text-cc-brand hover:underline"
              >
                {contentOpen ? "Show less" : "Read more"}
              </button>
            </>
          ) : (
            <p className="mt-[9px] text-[14px] text-cc-dim leading-[1.6]">
              No description on file yet. Open the course on KTH.se for the
              official syllabus.
            </p>
          )}
        </div>

        {!statsAnswered && (
          <div className="rounded-[12px] border border-cc-rule bg-cc-pg p-4">
            {statsFailed ? (
              <p className="text-[13px] text-cc-dim">
                Could not load what reviewers said about this course.
              </p>
            ) : (
              <Skeleton className="h-24 w-full" />
            )}
          </div>
        )}
        {statsAnswered && stats === null && (
          <div className="rounded-[12px] border border-cc-rule bg-cc-pg p-4 text-[13px] text-cc-dim">
            No reviews yet — be the first to write one.
          </div>
        )}
        {statsAnswered && stats !== null && (
          <ReviewsSummary stats={stats} onReadReviews={revealReviews} />
        )}

        <div className="flex items-center justify-between gap-3 rounded-[10px] border border-cc-rule bg-cc-info px-[13px] py-[11px]">
          <p className="font-medium text-[12.5px] text-cc-brand leading-[1.45]">
            Taken this course? Your review helps the next student decide.
          </p>
          <button
            type="button"
            onClick={onWriteReview}
            className="flex h-[34px] flex-none items-center gap-[7px] whitespace-nowrap rounded-[8px] bg-cc-btn px-[13px] font-medium text-[13px] text-cc-btn-fg hover:opacity-[0.88]"
          >
            Write a review
          </button>
        </div>

        {statsAnswered && stats !== null && (
          <div>
            <div
              ref={reviewsHeadingRef}
              className="flex border-cc-rule border-b"
            >
              <button
                type="button"
                onClick={() => setReviewsOpen((open) => !open)}
                aria-expanded={reviewsOpen}
                className={cn(
                  "-mb-px flex items-center gap-[7px] border-b-2 pb-[9px] font-semibold text-[13px]",
                  reviewsOpen
                    ? "border-cc-brand text-cc-brand"
                    : "border-transparent text-cc-muted",
                )}
              >
                Reviews · {stats.reviewCount}
                <span aria-hidden="true" className="text-[9px]">
                  {reviewsOpen ? "▴" : "▾"}
                </span>
              </button>
            </div>

            {/* `stats.reviewCount` above is the summary's count, and the list
                is its own request. An errored list rendered as `[]` would put
                "Reviews · 4" over an empty list and read as four reviews that
                are gone, so a list that failed says so instead. */}
            {reviewsOpen && (
              <div className="mt-[13px]">
                {reviews.isError ? (
                  <p className="text-[13px] text-cc-dim">
                    Could not load the reviews for this course. Try again.
                  </p>
                ) : reviews.isSuccess ? (
                  <ReviewList courseCode={courseCode} reviews={reviews.data} />
                ) : (
                  <Skeleton className="h-24 w-full" />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
