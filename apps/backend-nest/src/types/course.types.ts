export interface CourseSummary {
  courseCode: string;
  titleEng: string;
  currentStatus: string;
  credits: number | null;
  creditUnit: string | null;
  department: string;
  startTerms: number[];
  examTypes: string[] | null;
  languages: string[];
  updatedAt: string;
}

export interface CourseDetails {
  courseCode: string;
  titleEng: string;
  titleSwe: string;
  department: string;
  departmentCode: string;
  credits: number | null;
  creditUnit: string | null;
  educationalLevel: string | null;
  gradeScale: string | null;
  goals: string | null;
  content: string | null;
  eligibility: string | null;
  rounds: CourseRoundSummary[];
  examinations: ExamRoundSummary[];
}

export interface CourseRoundSummary {
  startTerm: number;
  formattedPeriodsAndCredits: string | null;
  studyPace: number | null;
  language: string | null;
  tutoringForm: string | null;
  tutoringTime: string | null;
  isProgrammeCourse: boolean;
  schemaURL: string | null;
}

export interface ExamRoundSummary {
  examCode: string;
  title: string | null;
  credits: number | null;
  gradeScaleCode: string | null;
}

export interface SearchResponse {
  results: CourseSummary[];
  total: number;
  page: number;
  pageSize: number;
  timings?: { tookMs: number };
}
