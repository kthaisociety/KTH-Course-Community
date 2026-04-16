import { createAsyncThunk } from "@reduxjs/toolkit";
import type { CourseDetails } from "@shared/types";
import { getCourseDetails } from "@/lib/courses";

export const fetchCourseInfo = createAsyncThunk<CourseDetails, string>(
  "course/fetchCourseInfo",
  async (courseCode) => getCourseDetails(courseCode),
);
