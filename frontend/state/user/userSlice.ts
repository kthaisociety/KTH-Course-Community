import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Review } from "@shared/types";
import { clearSession, getSession } from "../session/sessionSlice";

export interface UserState {
  name: string;
  email: string;
  userFavorites: string[];
  profilePicture: string | null;
  userReviews: Review[];
}

const initialState: UserState = {
  name: "",
  email: "",
  userFavorites: [],
  profilePicture: null,
  userReviews: [],
};

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<UserState>) => {
      state.name = action.payload.name;
      state.email = action.payload.email;
      state.userFavorites = action.payload.userFavorites;
      state.profilePicture = action.payload.profilePicture ?? null;
      state.userReviews = action.payload.userReviews;
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
      })
      .addCase(clearSession, (state) => {
        state.name = "";
        state.email = "";
        state.userFavorites = [];
        state.profilePicture = null;
        state.userReviews = [];
      });
  },
});

export const { setUser, toggleFavoriteSuccess, setProfilePicture, clearUser } =
  userSlice.actions;
export default userSlice.reducer;
