import { createAsyncThunk } from "@reduxjs/toolkit";
import type { ReviewFormData } from "@/components/review";
import {
  createReview,
  dislikeReview,
  findAllReviews,
  likeReview,
} from "@/lib/reviews";

export const fetchCourseReviews = createAsyncThunk(
  "reviews/fetchCourseReviews",
  async (payload: { courseCode: string; userId?: string }) => {
    const reviews = await findAllReviews(payload.courseCode, payload.userId);
    return reviews;
  },
);

export const submitReview = createAsyncThunk(
  "reviews/submitReview",
  async (payload: {
    courseCode: string;
    userId: string;
    reviewForm: ReviewFormData;
  }) => {
    await createReview(payload.courseCode, payload.userId, payload.reviewForm);
    return true;
  },
);

export const likeCourseReview = createAsyncThunk(
  "reviews/likeCourseReview",
  async (payload: { reviewId: string; userId: string }) => {
    await likeReview(payload.reviewId, payload.userId);
    return payload.reviewId;
  },
);

export const dislikeCourseReview = createAsyncThunk(
  "reviews/dislikeCourseReview",
  async (payload: { reviewId: string; userId: string }) => {
    await dislikeReview(payload.reviewId, payload.userId);
    return payload.reviewId;
  },
);
