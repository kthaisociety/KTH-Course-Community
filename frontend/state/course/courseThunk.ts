import { createAsyncThunk } from "@reduxjs/toolkit";
import type { CourseDetails } from "@shared/types";
import { getCourseDetails } from "@/lib/courses";

export const fetchCourseDetails = createAsyncThunk<CourseDetails, string>(
  "course/fetchCourseDetails",
  async (courseCode) => getCourseDetails(courseCode),
);
