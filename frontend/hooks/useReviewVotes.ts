"use client";

import { useCallback } from "react";
import { useDispatch } from "react-redux";
import { toast } from "sonner";
import { useSessionData } from "@/hooks/sessionHooks";
import {
  fetchCourseReviews,
  likeCourseReview,
} from "@/state/reviews/reviewThunk";
import type { Dispatch } from "@/state/store";

export function useReviewVotes(courseCode: string) {
  const dispatch = useDispatch<Dispatch>();
  const { userId } = useSessionData();

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
