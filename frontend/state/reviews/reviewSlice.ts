import { createSlice } from "@reduxjs/toolkit";
import {
  dislikeCourseReview,
  fetchCourseReviews,
  likeCourseReview,
  submitReview,
} from "./reviewThunk";

type Review = {
  userId: string;
  id: string;
  createdAt: Date;
  updatedAt: Date;
  courseCode: string;
  easyScore: number;
  usefulScore: number;
  interestingScore: number;
  wouldRecommend: boolean;
  content: string;
};

const initialState: {
  reviews: Review[] | null;
  loading: boolean;
  error: string | null;
} = {
  reviews: null,
  loading: false,
  error: null,
};

const reviewSlice = createSlice({
  name: "reviews",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCourseReviews.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCourseReviews.fulfilled, (state, action) => {
        state.reviews = action.payload;
        state.loading = false;
      })
      .addCase(fetchCourseReviews.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? null;
      })
      .addCase(submitReview.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(submitReview.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(submitReview.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? null;
      })
      .addCase(likeCourseReview.fulfilled, () => {
        // Optionally handle update logic directly here or refetch reviews
      })
      .addCase(dislikeCourseReview.fulfilled, () => {
        // Optionally handle update logic directly here or refetch reviews
      });
  },
});

export default reviewSlice.reducer;
