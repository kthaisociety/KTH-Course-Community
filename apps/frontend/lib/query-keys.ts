export const queryKeys = {
  me: ["me"] as const,
  courseDetails: (courseCode: string) =>
    ["course", "details", courseCode] as const,
  courseSummary: (courseCode: string) =>
    ["course", "summary", courseCode] as const,
  reviews: (courseCode: string) => ["reviews", courseCode] as const,
  search: (query: string, filters: Record<string, string | string[]>) =>
    ["search", query, filters] as const,
};
