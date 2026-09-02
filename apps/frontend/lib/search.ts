import type { SearchResponse } from "@shared/types";
import { nestHttpUrl } from "@/lib/nest-http";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;

export async function searchCourses(
  query: string,
  filters: Record<string, string | string[]> = {},
): Promise<SearchResponse> {
  if (!query.trim()) {
    return {
      results: [],
      total: 0,
      page: DEFAULT_PAGE,
      pageSize: DEFAULT_PAGE_SIZE,
    };
  }

  const params = new URLSearchParams({
    q: query,
    page: String(DEFAULT_PAGE),
    size: String(DEFAULT_PAGE_SIZE),
  });

  for (const [k, v] of Object.entries(filters)) {
    if (Array.isArray(v)) {
      for (const vv of v) params.append(k, vv);
    } else {
      params.append(k, v);
    }
  }

  try {
    const res = await fetch(nestHttpUrl(`/search?${params.toString()}`));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as SearchResponse;
  } catch (err: unknown) {
    const rawMessage = err instanceof Error ? err.message : "Search failed";
    throw new Error(
      rawMessage === "Failed to fetch"
        ? "Could not reach the server. Check that the backend is running and Next.js /api/nest rewrites are configured."
        : rawMessage,
    );
  }
}
