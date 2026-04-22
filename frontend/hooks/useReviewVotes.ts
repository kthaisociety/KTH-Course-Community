"use client";

import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import {
  fetchCourseReviews,
  likeCourseReview,
} from "@/state/reviews/reviewThunk";
import type { Dispatch, RootState } from "@/state/store";

export function useReviewVotes(courseCode: string) {
  const dispatch = useDispatch<Dispatch>();
  const userId = useSelector((s: RootState) => s.session.userId);

  const like = useCallback(
    async (postId: string) => {
      if (!userId) return;
      try {
        await dispatch(likeCourseReview({ reviewId: postId, userId })).unwrap();
        dispatch(fetchCourseReviews({ courseCode, userId }));
      } catch {
        toast.error("Failed to update vote", {
          description: "Try again later",
        });
      }
    },
    [dispatch, userId, courseCode],
  );

  const dislike = useCallback(
    async (postId: string) => {
      if (!userId) return;
      void postId;
      toast.info("Dislike is temporarily unavailable");
    },
    [userId],
  );

  return { like, dislike };
}
