import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  doublePrecision,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  unique,
  vector,
} from "drizzle-orm/pg-core";

import { users } from "./auth-schema";

export * from "./auth-schema";

export const courseState = pgEnum("course_state", [
  "CANCELLED",
  "ESTABLISHED",
  "DEACTIVATED",
]);

export const reviewVoteType = pgEnum("review_vote_type", ["up", "down"]);

export const nodeStyle = customType<{ data: string }>({
  dataType() {
    return "node_style";
  },
});

export const nodeSignalStyle = customType<{ data: string }>({
  dataType() {
    return "node_signal_style";
  },
});

// used for pgvector full-text search
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

// --- COURSE TABLES ----------------
// courses table contains core course data.
// more information is stored in courseRounds table
export const courses = pgTable(
  "courses",
  {
    code: text("code").primaryKey(),
    name: text("name").notNull(), // TODO: remove this, redudant info
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
    embedding: vector("embedding", { dimensions: 1536 }),
    embeddingHash: text("embedding_hash"),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      sql`to_tsvector('simple', coalesce(name_english, '') || ' ' || coalesce(name_swedish, '') || ' ' || coalesce(code, '') || ' ' || coalesce(goals, '') || ' ' || coalesce(content, ''))`,
    ),
  },
  (table) => [
    index("courses_search_vector_idx").using("gin", table.searchVector),
    index("courses_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
    index("courses_name_trgm_idx").using("gin", table.name.op("gin_trgm_ops")),
    index("courses_code_trgm_idx").using("gin", table.code.op("gin_trgm_ops")),
  ],
);

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

export const coursePrerequisites = pgTable(
  "course_prerequisites",
  {
    courseCode: text("course_code")
      .notNull()
      .references(() => courses.code),
    prerequisiteCourseCode: text("prerequisite_course_code")
      .notNull()
      .references(() => courses.code),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.courseCode, table.prerequisiteCourseCode],
    }),
  ],
);

export type InsertCoursePrerequisite = typeof coursePrerequisites.$inferInsert;
export type SelectCoursePrerequisite = typeof coursePrerequisites.$inferSelect;

export const courseExplore = pgTable("course_explore", {
  courseCode: text("course_code")
    .primaryKey()
    .references(() => courses.code),
  embedding: vector("embedding", { dimensions: 1536 }),
  sourceHash: text("source_hash"),
  searchVector: tsvector("search_vector"),
  embeddingModel: text("embedding_model"),
  embeddedAt: timestamp("embedded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export type InsertCourseExplore = typeof courseExplore.$inferInsert;
export type SelectCourseExplore = typeof courseExplore.$inferSelect;

export const userSavedCourses = pgTable(
  "user_saved_courses",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    courseCode: text("course_code")
      .notNull()
      .references(() => courses.code),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.courseCode] })],
);

export type InsertUserSavedCourse = typeof userSavedCourses.$inferInsert;
export type SelectUserSavedCourse = typeof userSavedCourses.$inferSelect;

export const userTakenCourses = pgTable(
  "user_taken_courses",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    courseCode: text("course_code")
      .notNull()
      .references(() => courses.code),
    attendancePeriods: text("attendance_periods"),
    attendanceYear: integer("attendance_year"),
    grade: text("grade"),
    earnedCredits: real("earned_credits"),
    transcriptImportedAt: timestamp("transcript_imported_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.courseCode] })],
);

export type InsertUserTakenCourse = typeof userTakenCourses.$inferInsert;
export type SelectUserTakenCourse = typeof userTakenCourses.$inferSelect;

export const collections = pgTable(
  "collections",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    unique("collections_id_user_id_unique").on(table.id, table.userId),
  ],
);

export type InsertCollection = typeof collections.$inferInsert;
export type SelectCollection = typeof collections.$inferSelect;

export const collectionCourses = pgTable(
  "collection_courses",
  {
    collectionId: text("collection_id").notNull(),
    collectionUserId: text("collection_user_id").notNull(),
    courseCode: text("course_code").notNull(),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.collectionId, table.courseCode] }),
    foreignKey({
      name: "collection_courses_collection_owner_fk",
      columns: [table.collectionId, table.collectionUserId],
      foreignColumns: [collections.id, collections.userId],
    }),
    foreignKey({
      name: "collection_courses_saved_course_fk",
      columns: [table.collectionUserId, table.courseCode],
      foreignColumns: [userSavedCourses.userId, userSavedCourses.courseCode],
    }),
    check("position_nonnegative", sql`${table.position} >= 0`),
  ],
);

export type InsertCollectionCourse = typeof collectionCourses.$inferInsert;
export type SelectCollectionCourse = typeof collectionCourses.$inferSelect;

export const usersGraphNodes = pgTable("users_graph_nodes", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id),
  x: doublePrecision("x").notNull(),
  y: doublePrecision("y").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export type InsertUsersGraphNode = typeof usersGraphNodes.$inferInsert;
export type SelectUsersGraphNode = typeof usersGraphNodes.$inferSelect;

export const usersGraphBackboneEdges = pgTable(
  "users_graph_backbone_edges",
  {
    nodeUserId: text("node_user_id")
      .notNull()
      .references(() => usersGraphNodes.userId),
    anchorUserId: text("anchor_user_id")
      .notNull()
      .references(() => usersGraphNodes.userId),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.nodeUserId, table.anchorUserId] }),
    check(
      "no_self_backbone_edge",
      sql`${table.nodeUserId} <> ${table.anchorUserId}`,
    ),
  ],
);

export type InsertUsersGraphBackboneEdge =
  typeof usersGraphBackboneEdges.$inferInsert;
export type SelectUsersGraphBackboneEdge =
  typeof usersGraphBackboneEdges.$inferSelect;

export const usersNodeProfiles = pgTable("users_node_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id),
  color: text("color").notNull(),
  style: nodeStyle("style").notNull(),
  signalStyle: nodeSignalStyle("signal_style").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export type InsertUsersNodeProfile = typeof usersNodeProfiles.$inferInsert;
export type SelectUsersNodeProfile = typeof usersNodeProfiles.$inferSelect;

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

// --- REVIEW / FORUM TABLES ----------------
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
  examinationMethods: integer("examination_methods").notNull().default(0), // 1-5
  theoreticalVsApplied: integer("theoretical_vs_applied").notNull().default(0), // 1-5
  workload: integer("workload").notNull().default(0), // 1-5
  learningExperience: integer("learning_experience").notNull().default(0), // 1-5

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

export const reviewVotes = pgTable(
  "review_votes",
  {
    voterUserId: text("voter_user_id")
      .notNull()
      .references(() => users.id),
    reviewId: text("review_id")
      .notNull()
      .references(() => reviews.id),
    voteType: reviewVoteType("vote_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.voterUserId, table.reviewId] })],
);

export type InsertReviewVote = typeof reviewVotes.$inferInsert;
export type SelectReviewVote = typeof reviewVotes.$inferSelect;

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

// --- FEEDBACK / FORM TABLES ----------------
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
