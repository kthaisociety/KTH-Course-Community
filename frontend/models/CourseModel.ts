
/** Full course description (detail views). */
export interface CourseDetails {
  courseCode: string;
  name: string;
  department: string;
  content: string;
  goals: string;
  summary?: string; // an LLM generated summary (not implemented yet).  
  rating?: number;  // TODO: will have to revise this, since we no longer have ratings. 
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
  // ensure this matches the backend in the future
  query: string;
  page: number;
  pageSize: number;
  sort?: string;
  filters?: Record<string, string | string[]>;
}

export interface SearchResponse {
  results: CourseSummary[]; // ensures the results are course objects (but this has to be updated to match backend logic)
  total: number;
  page: number;
  pageSize: number;
  timings?: { tookMs: number };
  // could also include facets, i.e. filters ("get all courses over a certain rating")
}
