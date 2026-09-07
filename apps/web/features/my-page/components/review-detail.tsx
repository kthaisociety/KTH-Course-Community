"use client";

import parse from "html-react-parser";
import { ArrowLeft, Pencil, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { Kicker } from "@/components/ui/kicker";
import { useCourseDetails } from "@/features/courses";
import {
  ExaminationBlock,
  isAnswered,
  ProfileBlock,
  type ReviewDraft,
  ReviewDraftEditor,
  toReviewDraft,
  toReviewFormData,
  useEditReview,
} from "@/features/reviews";
import { formatHp } from "@/lib/kth";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { cn } from "@/lib/utils";
import type { Review } from "@/types";

type Props = {
  review: Review;
  onBack: () => void;
  onDelete: () => void;
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[12px] border border-cc-rule bg-cc-pg p-4">
      {children}
    </div>
  );
}

/**
 * One of the viewer's own reviews, opened on My Page.
 *
 * This is the `isDetail` branch of
 * `docs/design_ref/2026-09-06/Course Community - My Page.dc.html`: the two
 * columns give way to one 760px panel with a back link, the course above it and
 * the review's own blocks inside it. The artboard's footer offers Delete review
 * and Edit review, and its `reviewState` prop names an `editing` state it never
 * draws — this is that state, and it is the review editor every other surface
 * writes a review in.
 *
 * ## Reading and rewriting are the same panel
 *
 * The read half is `ExaminationBlock` and `ProfileBlock`, the same blocks the
 * Review Card expands into. The edit half is `ReviewDraftEditor`, the same form
 * the workspace pane draws. Nothing here is a third copy of either — this file
 * is the frame, the two states, and the save.
 *
 * The draft is seeded from the row through `toReviewDraft` and kept in this
 * component until it is saved. Nothing reaches `localStorage`: a published
 * review is not a draft, and an abandoned edit to one should not outlive the
 * page. Backing out therefore discards, which is why the back link says so
 * while there are changes to lose.
 */
export function ReviewDetail({ review, onBack, onDelete }: Readonly<Props>) {
  const details = useCourseDetails(review.courseCode);
  const editReview = useEditReview();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ReviewDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const course = details.data;
  const meta = course
    ? `${formatHp(course.credits)} hp${course.department ? ` · ${course.department}` : ""}`
    : review.courseCode;
  const helpful = review.upvoteCount - review.downvoteCount;

  // The row until the writer touches something, and their answers after that.
  // Seeding on demand rather than in an effect keeps the two from disagreeing:
  // a refetch that restates the review is picked up for as long as nothing has
  // been typed over it.
  const shown = draft ?? toReviewDraft(review);
  const dirty = draft !== null;

  async function save() {
    const form = toReviewFormData(shown);
    if (!form) return;
    setSaving(true);
    const ok = await editReview(review.id, form);
    setSaving(false);
    if (!ok) return;
    // Back to reading, and back to the row: `reviews.update` has invalidated
    // every list, so the panel is about to be handed the saved version.
    setDraft(null);
    setEditing(false);
  }

  function stopEditing() {
    setDraft(null);
    setEditing(false);
  }

  return (
    <div className="flex justify-center px-7 pt-5 pb-2 @max-[440px]:px-[14px]">
      <div className="w-full max-w-[760px]">
        <button
          type="button"
          onClick={editing ? stopEditing : onBack}
          className="flex cursor-pointer items-center gap-2 font-medium text-[13px] text-cc-brand hover:underline"
        >
          <ArrowLeft aria-hidden className="size-[15px]" strokeWidth={2} />
          {editing
            ? dirty
              ? "Discard changes"
              : "Back to your review"
            : "Back to your reviews"}
        </button>

        <div className="mt-3.5 overflow-hidden rounded-[14px] border border-cc-rule bg-cc-surface">
          <div className="border-cc-warn-border border-b bg-cc-warn-solid px-[22px] pt-5 pb-[18px]">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium font-mono text-[12.5px] text-cc-brand">
                  {review.courseCode}
                </div>
                <h2 className="mt-[7px] font-semibold text-[21px] leading-[1.25]">
                  {course?.titleEng ?? review.courseCode}
                </h2>
                <p className="mt-1.5 text-[12.5px] text-cc-dim">{meta}</p>
              </div>
              <div className="flex flex-none items-center gap-[7px] rounded-full border border-cc-warn-border bg-cc-surface px-[11px] py-[5px] font-semibold text-[12px] text-cc-warn-ink">
                <ThumbsUp
                  aria-hidden
                  className="size-[13px]"
                  strokeWidth={1.8}
                />
                {helpful} helpful
              </div>
            </div>
          </div>

          <div className="px-[22px] pt-[18px] pb-5">
            {editing ? (
              <ReviewDraftEditor draft={shown} onChange={setDraft} />
            ) : (
              <div className="flex flex-col gap-3.5">
                <Card>
                  <ExaminationBlock
                    examinationDistribution={review.examinationDistribution}
                    approachTheoryPercent={review.approachTheoryPercent}
                  />
                </Card>

                <Card>
                  <div className="flex flex-col gap-3.5">
                    <ProfileBlock
                      workloadScore={review.workloadScore}
                      learningScore={review.learningScore}
                    />
                  </div>
                </Card>

                <Card>
                  <Kicker>Your take</Kicker>
                  <div className="mt-2.5 flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className="size-[9px] flex-none rounded-full"
                      style={{
                        background: review.happyTook
                          ? "var(--cc-success)"
                          : "var(--cc-warn-btn)",
                      }}
                    />
                    <div
                      className={cn(
                        "font-semibold text-[14.5px]",
                        review.happyTook
                          ? "text-cc-success-ink"
                          : "text-cc-danger-ink",
                      )}
                    >
                      {review.happyTook
                        ? "You are happy you took it"
                        : "You are not happy you took it"}
                    </div>
                  </div>
                  {review.message ? (
                    <div className="prose prose-sm mt-3 max-w-none text-[14px] text-cc-ink2 leading-[1.6]">
                      {parse(sanitizeHtml(review.message))}
                    </div>
                  ) : (
                    <p className="mt-3 text-[13.5px] text-cc-dim italic">
                      Scores only — you wrote nothing with this one.
                    </p>
                  )}
                </Card>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-cc-rule border-t bg-cc-pg px-[22px] py-3.5 @max-[560px]:flex-col @max-[560px]:items-stretch">
            <p className="m-0 text-[12px] text-cc-dim2">
              {editing
                ? "Saving replaces the review already published. Reviews are anonymous either way."
                : "Only you can see this page. On the course it is anonymous."}
            </p>
            <div className="flex flex-none justify-end gap-[9px]">
              {editing ? (
                <button
                  type="button"
                  disabled={!isAnswered(shown) || saving}
                  title={
                    isAnswered(shown)
                      ? undefined
                      : "Answer happy, workload and learning to save — the write-up is the only optional part"
                  }
                  onClick={save}
                  className={cn(
                    "flex h-[38px] cursor-pointer items-center rounded-[9px] px-4 font-semibold text-[13px] disabled:cursor-not-allowed",
                    isAnswered(shown)
                      ? "bg-cc-btn text-cc-btn-fg"
                      : "bg-cc-pill text-cc-dim",
                  )}
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onDelete}
                    className="flex h-[38px] cursor-pointer items-center rounded-[9px] border border-cc-rule3 bg-cc-surface px-3.5 font-medium text-[13px] text-cc-chip-ink transition-colors hover:border-cc-danger hover:text-cc-danger"
                  >
                    Delete review
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="flex h-[38px] cursor-pointer items-center gap-2 rounded-[9px] bg-cc-btn px-4 font-semibold text-[13px] text-cc-btn-fg"
                  >
                    <Pencil
                      aria-hidden
                      className="size-[15px]"
                      strokeWidth={1.9}
                    />
                    Edit review
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
