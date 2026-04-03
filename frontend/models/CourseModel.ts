export interface Course {
  _id: string;
  courseCode: string;
  name: string;
  /** Full course description (detail views). */
  content: string;
  /** Short summary for cards / previews. */
  summary?: string;
  goals: string;
  department: string;
  rating?: number;
  credits: number | null;
}

// New type that is based on Course, but contains user data as well
// (for now just if the course is part of userFavorites or not)
export interface CourseWithUserInfo extends Course {
  isUserFavorite: boolean;
}

export interface SearchParams {
  // ensure this matches the backend in the future
  query: string;
  page: number;
  pageSize: number;
  sort?: string;
  filters?: Record<string, string | string[]>;
}

export interface SearchResponse {
  results: Course[]; // ensures the results are course objects (but this has to be updated to match backend logic)
  total: number;
  page: number;
  pageSize: number;
  timings?: { tookMs: number };
  // could also include facets, i.e. filters ("get all courses over a certain rating")
}
