export type CourseMapping = {
  course_name: string;
  course_code: string;
  department: string;
  goals: string;
  /** Full course description (e.g. course page). */
  content: string;
  /** Short summary for cards / previews; optional until indexed in ES. */
  summary?: string;
};
