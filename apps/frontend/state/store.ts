import { configureStore } from "@reduxjs/toolkit";
import courseReducer from "./course/courseSlice";
import reviewReducer from "./reviews/reviewSlice";
import searchReducer from "./search/searchSlice";
import sessionReducer from "./session/sessionSlice";
import userReducer from "./user/userSlice";

export const store = configureStore({
  reducer: {
    search: searchReducer,
    user: userReducer,
    session: sessionReducer,
    course: courseReducer,
    reviews: reviewReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type Dispatch = typeof store.dispatch;
