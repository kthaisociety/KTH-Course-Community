import type { SearchResponse } from "@shared/types";
import type { Dispatch, RootState } from "@/state/store";
import { searchFailed, searchRequested, searchSucceeded } from "./searchSlice";

export function executeSearch() {
  return async (dispatch: Dispatch, getState: () => RootState) => {
    const { query, page, pageSize, sort, filters } = getState().search;

    if (!query?.trim()) {
      dispatch(
        searchSucceeded({
          results: [],
          total: 0,
          page: 1,
          pageSize: pageSize || 10,
        }),
      );
      return;
    }

    dispatch(searchRequested());

    const params = new URLSearchParams({
      q: query,
      page: String(page),
      size: String(pageSize),
    });
    if (sort) params.set("sort", sort);

    for (const [k, v] of Object.entries(filters || {})) {
      if (Array.isArray(v)) {
        for (const vv of v) params.append(k, vv);
      } else {
        params.append(k, v);
      }
    }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_DOMAIN}/search?${params.toString()}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const body = (await res.json()) as SearchResponse;
      dispatch(searchSucceeded(body));
    } catch (err: unknown) {
      const rawMessage = err instanceof Error ? err.message : "Search failed";
      const message =
        rawMessage === "Failed to fetch"
          ? "Could not reach the server. Check that the backend is running and NEXT_PUBLIC_BACKEND_DOMAIN is correct."
          : rawMessage;
      dispatch(searchFailed(message));
    }
  };
}
