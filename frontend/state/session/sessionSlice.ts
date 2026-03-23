import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import Session from "supertokens-auth-react/recipe/session";
import { setUser } from "../user/userSlice";

export interface SessionState {
  userId: string;
  jwtPayload: object;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const initialState: SessionState = {
  userId: "",
  jwtPayload: {},
  isAuthenticated: false,
  isLoading: true,
};

export const getSession = createAsyncThunk(
  "session/getSession",
  async (_, { dispatch }) => {
    if (await Session.doesSessionExist()) {
      const backendDomain = process.env.NEXT_PUBLIC_BACKEND_DOMAIN;
      const userData = await fetch(`${backendDomain}/user/me`, {
        credentials: "include",
      }).then((res) => res.json());

      dispatch(
        setUser({
          name: userData.name,
          email: userData.email,
          userFavorites: userData.userFavorites ?? [],
          profilePicture: userData.profilePicture ?? null,
        }),
      );

      return {
        userId: userData.userId,
        jwtPayload: await Session.getAccessTokenPayloadSecurely(),
        isAuthenticated: true,
      };
    }
    return {
      userId: "",
      jwtPayload: {},
      isAuthenticated: false,
    };
  },
);

export const logout = createAsyncThunk(
  "session/logout",
  async (_, { dispatch }) => {
    await Session.signOut();
    dispatch(clearSession());
    // Clear user data as well
    dispatch(
      setUser({
        name: "",
        email: "",
        userFavorites: [],
        profilePicture: null,
      }),
    );
    // Redirect to home page
    window.location.href = "/";
  },
);

export const sessionSlice = createSlice({
  name: "session",
  initialState,
  reducers: {
    clearSession: (state) => {
      state.isAuthenticated = false;
      state.userId = "";
      state.jwtPayload = {};
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getSession.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getSession.fulfilled, (state, action) => {
        state.isAuthenticated = action.payload.isAuthenticated;
        state.userId = action.payload.userId;
        state.jwtPayload = action.payload.jwtPayload;
        state.isLoading = false;
      })
      .addCase(getSession.rejected, (state) => {
        state.isAuthenticated = false;
        state.userId = "";
        state.jwtPayload = {};
        state.isLoading = false;
      });
  },
});

export const { clearSession } = sessionSlice.actions;

export default sessionSlice.reducer;
