"use client";

import { MessageSquare } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useMe } from "@/features/auth";
import type { Review as ReviewModel } from "@/types";
import { useRemoveReview } from "../hooks/use-remove-review";
import { useReviewVotes } from "../hooks/use-review-votes";
import { ReviewCard } from "./review-card";

type ReviewListProps = {
  reviews: ReviewModel[];
  /**
   * Take the viewer to their own review, in the editor that writes one.
   *
   * The list does not draw that editor itself. It is rendered inside the
   * workspace pane's details tab, and the pane already has a review tab for
   * this course whose whole job is the form — so editing switches to it rather
   * than unfolding a second copy of the form inside a scrolling list inside a
   * pane. Without a handler the author gets no pencil, which is what happens
   * anywhere the list is drawn outside a pane.
   */
  onEditReview?: () => void;
};

/**
 * A course's reviews, and the wiring the cards cannot own themselves: who the
 * viewer is, and what voting, editing and deleting actually call. The card
 * stays presentational, which is what makes it testable without a tRPC client.
 *
 * Visitors get no vote handler at all rather than buttons that would do
 * nothing — `reviews.vote` is a protected procedure.
 */
export function ReviewList({
  reviews,
  onEditReview,
}: Readonly<ReviewListProps>) {
  const { userId } = useMe();
  const { vote } = useReviewVotes();
  const removeReview = useRemoveReview();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  if (reviews.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MessageSquare />
          </EmptyMedia>
          <EmptyTitle>No reviews yet</EmptyTitle>
          <EmptyDescription>
            Be the first to add a review for this course.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {reviews.map((review) => {
        const isAuthor = Boolean(userId) && review.userId === userId;
        return (
          <ReviewCard
            key={review.id}
            review={review}
            isAuthor={isAuthor}
            onVote={
              userId ? (voteType) => void vote(review.id, voteType) : undefined
            }
            onEdit={isAuthor && onEditReview ? onEditReview : undefined}
            onDelete={
              isAuthor ? () => setPendingDeleteId(review.id) : undefined
            }
          />
        );
      })}

      <ConfirmDialog
        request={
          pendingDeleteId === null
            ? null
            : {
                eyebrow: "Reviews",
                title: "Delete this review?",
                body: "It is removed from the course for everyone, along with the votes it collected. This cannot be undone.",
                cancelLabel: "Keep it",
                actionLabel: "Delete review",
              }
        }
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => {
          const id = pendingDeleteId;
          setPendingDeleteId(null);
          if (id) void removeReview(id);
        }}
      />
    </div>
  );
}
