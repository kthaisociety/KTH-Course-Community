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
  // TODO: Add new data-fields to expand course table
  code: text("code").primaryKey(),
  department: text("department").notNull(),
  name: text("name").notNull(),
  state: courseState("state").notNull(),
  lastExaminationSemester: text("last_examination_semester"),
  credits: real("credits"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type InsertCourse = typeof courses.$inferInsert;
export type SelectCourse = typeof courses.$inferSelect;

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
