import { createAsyncThunk } from "@reduxjs/toolkit";
import { getCourseCredits, getCourseInfo, getCourseSummary } from "@/lib/courses";

// Thunk: Elasticsearch course document + Neon metadata + credits
export const fetchCourseInfo = createAsyncThunk(
  "course/fetchCourseInfo",
  async (courseCode: string) => {
    const [info, credits, neon] = await Promise.all([
      getCourseInfo(courseCode),
      getCourseCredits(courseCode),
      getCourseSummary(courseCode).catch(() => null),
    ]);
    return { ...info, credits, neon };
  },
);
