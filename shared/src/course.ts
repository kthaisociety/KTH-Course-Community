/** Full course description (detail views). */
export interface CourseDetails {
  courseCode: string;
  name: string;
  department: string;
  content: string;
  goals: string;
  summary?: string;
  rating?: number;
  credits: number | null;
}

/** Short summary for cards / previews. */
export interface CourseSummary {
  courseCode: string;
  department: string;
  name: string;
  currentStatus: string;
  updatedAt: string;
}

/** Course search types. */
export interface SearchParams {
  query: string;
  page: number;
  pageSize: number;
  sort?: string;
  filters?: Record<string, string | string[]>;
}

export interface SearchResponse {
  results: CourseSummary[];
  total: number;
  page: number;
  pageSize: number;
  timings?: { tookMs: number };
}
