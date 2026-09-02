import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { CourseSummary, SearchResponse } from "@shared/types";

interface SearchState {
  query: string;
  results: CourseSummary[]; // search results are course objects
  total: number;
  page: number; // current page
  pageSize: number; // number of results per page
  isLoading: boolean;
  error?: string;
  filters: Record<string, string | string[]>;
}

const initialState: SearchState = {
  // this is the initial state of the search slice
  query: "",
  results: [],
  total: 0,
  page: 1,
  pageSize: 10,
  isLoading: false,
  filters: {},
};

const searchSlice = createSlice({
  name: "search",
  initialState,
  reducers: {
    // reducers are the functions that modify the state
    queryChanged(state, action: PayloadAction<string>) {
      state.query = action.payload;
      state.page = 1; // reset page number to 1
    },
    pageChanged(state, action: PayloadAction<number>) {
      // page number changed
      state.page = action.payload;
    },
    filtersChanged(state, action: PayloadAction<SearchState["filters"]>) {
      // filters changed
      state.filters = action.payload;
      state.page = 1; // reset page number to 1
    },
    searchRequested(state) {
      // search requested (start of search)
      state.isLoading = true;
      state.error = undefined;
    },
    searchSucceeded(state, action: PayloadAction<SearchResponse>) {
      const { results, total, page, pageSize } = action.payload;
      state.results = results;
      state.total = total;
      state.page = page;
      state.pageSize = pageSize;
      state.isLoading = false;
    },
    searchFailed(state, action: PayloadAction<string>) {
      state.isLoading = false;
      state.error = action.payload;
    },
  },
});

export const {
  queryChanged,
  pageChanged,
  filtersChanged,
  searchRequested,
  searchSucceeded,
  searchFailed,
} = searchSlice.actions;

export default searchSlice.reducer;
