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
  onDelete: () => void;
  /**
   * Told whenever this body enters or leaves the editor.
   *
   * The card above it is what collapses the review, and a click on its summary
   * must not be able to throw away an unsaved edit. The card cannot know that
   * on its own — it renders this body without looking inside it — so the state
   * is reported up to the column, which declines to collapse while it is true.
   */
  onEditingChange?: (editing: boolean) => void;
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[12px] border border-cc-rule bg-cc-pg p-4">
      {children}
    </div>
  );
}

/**
 * One of the viewer's own reviews, unfolded on its own card on My Page.
 *
 * This is what a Review Card in the "Your reviews" column expands into, through
 * the card's `expandedSlot`: the course above the review, its own blocks inside
 * it, and a footer offering Delete review and Edit review. The artboard's
 * `reviewState` prop names an `editing` state it never draws — this is that
 * state, and it is the review editor every other surface writes a review in.
 *
 * The header band is the one
 * `docs/design_ref/2026-09-06/Course Community - My Page.dc.html:211` draws for
 * its `isDetail` branch, and the band is all this keeps of that branch: the
 * review no longer takes the whole tab, so the columns and the reviews the
 * reader upvoted stay where they were. ADR 0010 records that choice, and that
 * the ~535px a column leaves for the examination bar is a known, accepted cost
 * of it. The band's course code and meta line repeat the card's own meta row;
 * that redundancy is accepted too, because a review being read in full should
 * say which course it is of without the reader looking back up.
 *
 * ## Reading and rewriting are the same card
 *
 * The read half is `ExaminationBlock` and `ProfileBlock`, the same blocks the
 * Review Card expands into by default. The edit half is `ReviewDraftEditor`,
 * the same form the workspace pane draws. Nothing here is a third copy of
 * either — this file is the frame, the two states, and the save.
 *
 * The draft is seeded from the row through `toReviewDraft` and kept in this
 * component until it is saved. Nothing reaches `localStorage`: a published
 * review is not a draft, and an abandoned edit to one should not outlive the
 * page. Leaving the editor therefore discards, which is why the control that
 * leaves it says so while there are changes to lose — and why it stays on the
 * card while editing rather than leaving the reader to find the summary above.
 */
export function ExpandedReview({
  review,
  onDelete,
  onEditingChange,
}: Readonly<Props>) {
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
    // every list, so the card is about to be handed the saved version.
    stopEditing();
  }

  function startEditing() {
    setEditing(true);
    onEditingChange?.(true);
  }

  function stopEditing() {
    setDraft(null);
    setEditing(false);
    onEditingChange?.(false);
  }

  return (
    <div>
      {/*
        Only while editing, and only here. Collapsing the card is the summary's
        job now, so there is nothing to offer a reader who is merely reading —
        but a reader who is part-way through a rewrite needs a way out that
        says what leaving costs, and needs it on the card rather than in a
        summary they have scrolled past.
      */}
      {editing ? (
        <button
          type="button"
          onClick={stopEditing}
          className="mb-3 flex cursor-pointer items-center gap-2 font-medium text-[13px] text-cc-brand hover:underline"
        >
          <ArrowLeft aria-hidden className="size-[15px]" strokeWidth={2} />
          {dirty ? "Discard changes" : "Back to your review"}
        </button>
      ) : null}

      <div className="overflow-hidden rounded-[12px] border border-cc-rule bg-cc-surface">
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
              <ThumbsUp aria-hidden className="size-[13px]" strokeWidth={1.8} />
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
                  onClick={startEditing}
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
  );
}
