"use client";

import { MessageSquare } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { type EditableReview, Review, toEditableReview } from "./review";
import { ReviewCard } from "./review-card";

type ReviewListProps = {
  courseCode: string;
  reviews: ReviewModel[];
};

/**
 * A course's reviews, and the wiring the cards cannot own themselves: who the
 * viewer is, and what voting, editing and deleting actually call. The card
 * stays presentational, which is what makes it testable without a tRPC client.
 *
 * Visitors get no vote handler at all rather than buttons that would do
 * nothing — `reviews.vote` is a protected procedure.
 */
export function ReviewList({ courseCode, reviews }: Readonly<ReviewListProps>) {
  const { userId } = useMe();
  const { vote } = useReviewVotes();
  const removeReview = useRemoveReview();
  const [editing, setEditing] = useState<EditableReview | null>(null);
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
            onEdit={
              isAuthor ? () => setEditing(toEditableReview(review)) : undefined
            }
            onDelete={
              isAuthor ? () => setPendingDeleteId(review.id) : undefined
            }
          />
        );
      })}

      {editing ? (
        <Review
          key={editing.id}
          courseCode={courseCode}
          editing={editing}
          onEditingClose={() => setEditing(null)}
        />
      ) : null}

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this review?</AlertDialogTitle>
            <AlertDialogDescription>
              It is removed from the course for everyone, along with the votes
              it collected. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const id = pendingDeleteId;
                setPendingDeleteId(null);
                if (id) void removeReview(id);
              }}
            >
              Delete review
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
