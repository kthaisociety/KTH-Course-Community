import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Review, UserLikedReview } from "@shared/types";
import { clearSession, getSession } from "../session/sessionSlice";

export type TranscriptCourse = {
  courseCode: string;
  grade: string | null;
  credits: number | null;
};

export interface UserState {
  name: string;
  email: string;
  userFavorites: string[];
  profilePicture: string | null;
  userReviews: Review[];
  userLikedReviews: UserLikedReview[];
  transcriptCourses: TranscriptCourse[];
}

const initialState: UserState = {
  name: "",
  email: "",
  userFavorites: [],
  profilePicture: null,
  userReviews: [],
  userLikedReviews: [],
  transcriptCourses: [] as TranscriptCourse[],
};

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setUser: (
      state,
      action: PayloadAction<Omit<UserState, "transcriptCourses">>,
    ) => {
      state.name = action.payload.name;
      state.email = action.payload.email;
      state.userFavorites = action.payload.userFavorites;
      state.profilePicture = action.payload.profilePicture ?? null;
      state.userReviews = action.payload.userReviews;
      state.userLikedReviews = action.payload.userLikedReviews;
    },
    setTranscriptCourses: (
      state,
      action: PayloadAction<TranscriptCourse[]>,
    ) => {
      state.transcriptCourses = action.payload;
    },
    removeTranscriptCourse: (state, action: PayloadAction<string>) => {
      state.transcriptCourses = state.transcriptCourses.filter(
        (c) => c.courseCode !== action.payload,
      );
    },
    toggleFavoriteSuccess: (
      state,
      action: PayloadAction<{
        courseCode: string;
        action: "added" | "removed";
      }>,
    ) => {
      const { courseCode, action: toggleAction } = action.payload;

      if (toggleAction === "added") {
        // Add the course code if it's not already present
        if (!state.userFavorites.includes(courseCode)) {
          state.userFavorites.push(courseCode);
        }
      } else if (toggleAction === "removed") {
        // Remove the course code from the array
        state.userFavorites = state.userFavorites.filter(
          (code) => code !== courseCode,
        );
      }
    },
    setProfilePicture: (state, action: PayloadAction<string>) => {
      state.profilePicture = action.payload;
    },
    clearUser: (state) => {
      state.name = "";
      state.email = "";
      state.userFavorites = [];
      state.profilePicture = null;
      state.userReviews = [];
      state.userLikedReviews = [];
      state.transcriptCourses = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getSession.rejected, (state) => {
        state.name = "";
        state.email = "";
        state.userFavorites = [];
        state.profilePicture = null;
        state.userReviews = [];
        state.userLikedReviews = [];
        state.transcriptCourses = [];
      })
      .addCase(clearSession, (state) => {
        state.name = "";
        state.email = "";
        state.userFavorites = [];
        state.profilePicture = null;
        state.userReviews = [];
        state.userLikedReviews = [];
        state.transcriptCourses = [];
      });
  },
});

export const {
  setUser,
  toggleFavoriteSuccess,
  setProfilePicture,
  setTranscriptCourses,
  removeTranscriptCourse,
  clearUser,
} = userSlice.actions;
export default userSlice.reducer;
