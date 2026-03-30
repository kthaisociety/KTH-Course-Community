import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const courseState = pgEnum("course_state", [
  "CANCELLED",
  "ESTABLISHED",
  "DEACTIVATED",
]);

// courses table contains core course data.
// more information is stored in courseRounds table
export const courses = pgTable("courses", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  titleSwe: text("name_swedish").notNull(),
  titleEng: text("name_english").notNull(),
  state: courseState("state").notNull(),

  credits: real("credits").notNull(),
  creditUnit: text("credit_unit"),

  departmentCode: text("department_code").notNull(),
  department: text("department").notNull(),
  educationalLevelCode: text("educational_level_code"),
  gradeScaleCode: text("grade_scale_code"),

  // from latest publicSyllabusVersions entry
  goals: text("goals"),
  content: text("content"),
  eligibility: text("eligibility"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type InsertCourse = typeof courses.$inferInsert;
export type SelectCourse = typeof courses.$inferSelect;

// courseRounds is used for multiple course offerings across semesters
// e.g. DD2421, which can be taken P2 or in P3. This table round-specific information.
export const courseRounds = pgTable("course_rounds", {
  id: serial("id").primaryKey(),
  courseCode: text("course_code")
    .notNull()
    .references(() => courses.code, { onDelete: "cascade" }),
  startTerm: integer("start_term").notNull(), // e.g. 20252
  studyPace: integer("study_pace"), // percentage, e.g. 50
  schemaUrl: text("schema_url"),
  language: text("language"),
  tutoringForm: text("tutoring_form"), // "NML (Normal) or DST (Distance)"
  tutoringTimeOfDay: text("tutoring_time_of_day"), // "DAG (Day-time) or KVÄ (evenings)"
  formattedPeriodsAndCredits: text("formatted_periods_and_credits"), // e.g. "P1 (7,5 hp)"
  isPU: boolean("is_pu").notNull(), // Part of KTH programme
  isVU: boolean("is_vu").notNull(), // open course
});

export type InsertCourseRound = typeof courseRounds.$inferInsert;
export type SelectCourseRound = typeof courseRounds.$inferSelect;

// courseExaminations stores the examination components for a course.
// e.g. DD2421 has TEN1 (Tentamen, 6hp, AF) and LAB1 (Laborationer, 1.5hp, PF)
export const courseExaminations = pgTable(
  "course_examinations",
  {
    courseCode: text("course_code")
      .notNull()
      .references(() => courses.code, { onDelete: "cascade" }),
    examCode: text("exam_code").notNull(), // e.g. "TEN1"
    title: text("title"), // e.g. "Tentamen"
    credits: real("credits"),
    gradeScaleCode: text("grade_scale_code"), // e.g. "AF" or "PF"
  },
  (table) => [primaryKey({ columns: [table.courseCode, table.examCode] })],
);

export type InsertCourseExamination = typeof courseExaminations.$inferInsert;
export type SelectCourseExamination = typeof courseExaminations.$inferSelect;

// users contain all user data
export const users = pgTable("users", {
  // TODO: Add new user-data to expand user table
  id: text("id").primaryKey(), // This will be the SuperTokens user ID
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  profilePicture: text("profile_picture"), // URL to profile picture
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// TODO: This should be removed and replaced with new table
// junction table for mapping users to favorite courses
export const user_favorites = pgTable(
  "user_favorites",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }), // references a user in the user table as foreign key
    favoriteCourse: text("fav_course_code")
      .notNull()
      .references(() => courses.code, { onDelete: "cascade" }), // references a course code as foreign key
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.userId, table.favoriteCourse] }),
  }),
);

// table for reviews that references users (posters) and courses (reviewed)
export const reviews = pgTable("reviews", {
  id: text("id").primaryKey(), // review id
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }), // foreign key to users table
  courseCode: text("course_code")
    .notNull()
    .references(() => courses.code, { onDelete: "cascade" }), // foreign key to courses table

  // scores
  easyScore: integer("easy_score").notNull().default(0), // 1-5
  usefulScore: integer("useful_score").notNull().default(0), // 1-5
  interestingScore: integer("interesting_score").notNull().default(0), // 1-5

  wouldRecommend: boolean("would_recommend").notNull().default(false),
  content: text("content").notNull(),

  // timestamps
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export type InsertReview = typeof reviews.$inferInsert;
export type SelectReview = typeof reviews.$inferSelect;

// junction table for tracking user likes/dislikes on reviews
export const reviewLikes = pgTable(
  "review_likes",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reviewId: text("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    voteType: text("vote_type").notNull(), // "like" or "dislike"
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.reviewId] })],
);

export const feedback_form = pgTable("feedback_form", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type InsertFeedbackForm = typeof feedback_form.$inferInsert;
export type SelectFeedbackMessage = typeof feedback_form.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type SelectUser = typeof users.$inferSelect;
export type InsertUserFavorite = typeof user_favorites.$inferInsert;
export type SelectUserFavorites = typeof user_favorites.$inferSelect;
export type InsertReviewLike = typeof reviewLikes.$inferInsert;
export type SelectReviewLike = typeof reviewLikes.$inferSelect;
