import { createSlice } from "@reduxjs/toolkit";
import type { CourseDetails } from "@shared/types";
import { fetchCourseDetails } from "./courseThunk";

interface CourseState {
  courseDetails: CourseDetails | null;
  loading: boolean;
  error: string | null;
}

const initialState: CourseState = {
  courseDetails: null,
  loading: false,
  error: null,
};

const courseSlice = createSlice({
  name: "course",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCourseDetails.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCourseDetails.fulfilled, (state, action) => {
        state.courseDetails = action.payload;
        state.loading = false;
      })
      .addCase(fetchCourseDetails.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? null;
      });
  },
});

export default courseSlice.reducer;
