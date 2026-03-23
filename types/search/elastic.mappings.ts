export type CourseDocument = {
  course_code: string;
  course_name_swe: string;
  course_name_eng: string;
  department: string;
  credits: number;
  subject: string;
  periods: string[]; // e.g. ["P1", "P3"]
  course_category: ("OPEN COURSE" | "PROGRAMME COURSE")[]; // can be both
  goals: string;
  content: string;
  eligibility: string;
  state: "CANCELLED" | "ESTABLISHED" | "DEACTIVATED";
};
