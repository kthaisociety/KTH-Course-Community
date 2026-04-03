import { createSlice } from "@reduxjs/toolkit";
import type { NeonCoursePayload } from "@/lib/courses";
import { fetchCourseInfo } from "./courseThunk";

/** Merged ES + Neon + credits from `fetchCourseInfo`. */
interface CourseInfo {
  credits: number | null;
  /** Legacy / ES mapping field names */
  course_name?: string;
  course_code?: string;
  /** CamelCase from `GET /course/:code` */
  name?: string;
  courseCode?: string;
  department: string;
  goals: string;
  content: string;
  summary?: string;
  rating?: number;
  _id?: string;
  neon?: NeonCoursePayload | null;
}

interface CourseState {
  courseInfo: CourseInfo | null;
  loading: boolean;
  error: string | null;
}

const initialState: CourseState = {
  courseInfo: null,
  loading: false,
  error: null,
};

const courseSlice = createSlice({
  name: "course",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCourseInfo.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCourseInfo.fulfilled, (state, action) => {
        state.courseInfo = action.payload;
        state.loading = false;
      })
      .addCase(fetchCourseInfo.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? null;
      });
  },
});

export default courseSlice.reducer;
