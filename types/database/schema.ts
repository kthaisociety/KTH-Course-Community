import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const courseState = pgEnum("course_state", [
  "CANCELLED",
  "ESTABLISHED",
  "DEACTIVATED",
]);
// NOTE: Do we add foreign keys / relations to other tables in these tables?
export const courses = pgTable("courses", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  titleSwedish: text("name_swedish").notNull(),
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
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type InsertCourse = typeof courses.$inferInsert;
export type SelectCourse = typeof courses.$inferSelect;


// courseRounds is used for multiple course offerings across semesters
// e.g. DD2421, which can be taken P2 or in P3. This table round-specific information. 
export const courseRounds = pgTable("course_rounds", {
  shortName: text("short_name").primaryKey(), // e.g. "MLHT25" — unique per round
  courseCode: text("course_code")
    .notNull()
    .references(() => courses.code, { onDelete: "cascade" }),
  startTerm: integer("start_term").notNull(),  // e.g. 20252
  startWeekYear: integer("start_week_year"),
  startWeek: integer("start_week"),
  endWeekYear: integer("end_week_year"),
  endWeek: integer("end_week"),
  studyPace: integer("study_pace"),            // percentage, e.g. 50
  lectureCount: integer("lecture_count"),
  schemaUrl: text("schema_url"),
  language: text("language"),
  tutoringForm: text("tutoring_form"),         // e.g. "NML"
  tutoringTimeOfDay: text("tutoring_time_of_day"), // e.g. "DAG"
  formattedPeriodsAndCredits: text("formatted_periods_and_credits"), // e.g. "P1 (7,5 hp)"
  isPU: boolean("is_pu").notNull(),
  isVU: boolean("is_vu").notNull(),
});

export type InsertCourseRound = typeof courseRounds.$inferInsert;
export type SelectCourseRound = typeof courseRounds.$inferSelect;


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
  id: text("id").primaryKey(),        // review id
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),  // foreign key to users table
  courseCode: text("course_code")
    .notNull()
    .references(() => courses.code, { onDelete: "cascade" }),  // foreign key to courses table

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
  (table) => [
    primaryKey({ columns: [table.userId, table.reviewId] }),
  ],
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
