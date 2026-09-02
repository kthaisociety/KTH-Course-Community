import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { clearSession, getSession } from "../session/sessionSlice";

export interface UserState {
  name: string;
  email: string;
  userFavorites: string[];
  image: string | null;
}

const initialState: UserState = {
  name: "",
  email: "",
  userFavorites: [],
  image: null,
};

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<UserState>) => {
      state.name = action.payload.name;
      state.email = action.payload.email;
      state.userFavorites = action.payload.userFavorites;
      state.image = action.payload.image ?? null;
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
    setImage: (state, action: PayloadAction<string>) => {
      state.image = action.payload;
    },
    clearUser: (state) => {
      state.name = "";
      state.email = "";
      state.userFavorites = [];
      state.image = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getSession.rejected, (state) => {
        state.name = "";
        state.email = "";
        state.userFavorites = [];
        state.image = null;
      })
      .addCase(clearSession, (state) => {
        state.name = "";
        state.email = "";
        state.userFavorites = [];
        state.image = null;
      });
  },
});

export const { setUser, toggleFavoriteSuccess, setImage, clearUser } =
  userSlice.actions;
export default userSlice.reducer;
