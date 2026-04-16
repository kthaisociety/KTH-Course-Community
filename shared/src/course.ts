// TODO: Enrich the types with review data, and consider user data types
// That is after we have implemented the review / user based systems.

/** Short summary for cards / previews. */
export interface CourseSummary {
  courseCode: string;
  titleEng: string;
  currentStatus: string;
  credits: number | null;
  creditUnit: string | null;
  department: string; // NOTE: Might consider replacing with dep code.
  startTerms: number[]; // all start terms across rounds, e.g. [20252, 20253]
  examTypes: string[] | null; // TODO: Currently just a placeholder. Want to process exam types for each course.
  languages: string[];
  updatedAt: string; // could be nice to display e.g. "course data updated 3 days ago"?
}

/** Full course description (detail views). */
export interface CourseDetails {
  courseCode: string;
  titleEng: string;
  titleSwe: string; // NOTE: Do we even want to display the swedish title?
  department: string; // TODO: Consider if we actually need both department and code.
  departmentCode: string;
  credits: number | null;
  creditUnit: string | null;
  educationalLevel: string | null; // E.g.
  gradeScale: string | null; // E.g. "AF" or "PF"
  goals: string | null;
  content: string | null;
  eligibility: string | null; // NOTE: raw text from KOPPS; may process later.
  rounds: CourseRoundSummary[];
  examinations: ExamRoundSummary[];
}

/** One offering of a course in a given term (e.g. DD2421 P2 vs P3). */
export interface CourseRoundSummary {
  startTerm: number; // e.g. 20252
  formattedPeriodsAndCredits: string | null; // e.g. "P1 (7,5 hp)"
  studyPace: number | null; // percentage, e.g. 50
  language: string | null; // "swedish" or "english" mainly.
  tutoringForm: string | null; // "NML" (Normal) or "DST" (Distance)
  tutoringTime: string | null; // "DAG" or "KVÄ".
  isProgrammeCourse: boolean; // if not programme course, open for anyone to register.
  schemaURL: string | null; // not sure how consistent this is in the API.
}

/** One examination component of a course (e.g. TEN1, LAB1). */
export interface ExamRoundSummary {
  examCode: string; // e.g. "TEN1"
  title: string | null; // e.g. "Tentamen"
  credits: number | null;
  gradeScaleCode: string | null; // "AF" or "PF"
}

/** Card-facing shape: summary plus per-user info derived client-side. */
export type CourseWithUserInfo = CourseSummary & {
  isUserFavorite: boolean;
};

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
