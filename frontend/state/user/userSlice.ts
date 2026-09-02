import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Server state for the signed-in user that Better Auth does *not* carry.
 * `name`, `email` and `image` live on the Better Auth session — read them via
 * `useSessionData()` instead of duplicating them here.
 *
 * This slice is a stand-in for a query cache and is meant to be replaced by
 * TanStack Query; `useFavorites()` is the seam that makes that a body swap.
 */
export interface UserState {
  userFavorites: string[];
  status: "idle" | "loading" | "ready";
}

const initialState: UserState = {
  userFavorites: [],
  status: "idle",
};

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    favoritesLoading: (state) => {
      state.status = "loading";
    },
    favoritesLoaded: (state, action: PayloadAction<string[]>) => {
      state.userFavorites = action.payload;
      state.status = "ready";
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
    // Back to "idle" so the next signed-in user refetches instead of reading
    // the previous user's favorites.
    clearUser: (state) => {
      state.userFavorites = [];
      state.status = "idle";
    },
  },
});

export const {
  favoritesLoading,
  favoritesLoaded,
  toggleFavoriteSuccess,
  clearUser,
} = userSlice.actions;
export default userSlice.reducer;
