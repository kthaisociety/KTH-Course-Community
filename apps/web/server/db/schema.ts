import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
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

// Type-only, and must stay type-only: `@/types/review` also defines the zod
// schemas the router, service and review form share, and drizzle-kit loads
// this file. TypeScript erases the import before drizzle-kit ever evaluates
// that module, so no runtime dependency reaches the migration tooling.
import type { ExaminationDistribution } from "@/types/review";
import { users } from "./auth-schema";

export * from "./auth-schema";

export const courseState = pgEnum("course_state", [
  "CANCELLED",
  "ESTABLISHED",
  "DEACTIVATED",
]);

export const reviewVoteType = pgEnum("review_vote_type", ["up", "down"]);

/**
 * The two shape axes of a node profile, as Postgres enums.
 *
 * `"default"` leads each list and is the column default: it is what an
 * unconfigured node stores, and what a node whose tier has decayed renders as
 * while its stored pick is left untouched. The chosen values come from
 * `server/graph/appearance.ts`, which is the one definition of the vocabulary —
 * these declarations exist so the database refuses anything outside it.
 *
 * A value added here needs an `ALTER TYPE ... ADD VALUE` migration; see
 * `drizzle/0015_node_appearance_axes.sql` for the constraints on writing one.
 */
export const nodeStyle = pgEnum("node_style", [
  "default",
  "solid",
  "ring",
  "diamond",
]);

export const nodeSignalStyle = pgEnum("node_signal_style", [
  "default",
  "fade",
  "comet",
  "dashed",
]);

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
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("courses_code_trgm_idx").using("gin", table.code.op("gin_trgm_ops")),
  ],
);

export type InsertCourse = typeof courses.$inferInsert;
export type SelectCourse = typeof courses.$inferSelect;

// courseRounds is used for multiple course offerings across semesters
// e.g. DD2421, which can be taken P2 or in P3. This table round-specific information.
export const courseRounds = pgTable(
  "course_rounds",
  {
    // The serial id is the permanent key. A natural (course_code, round_code)
    // key needed KOPPS round.ladokUID, and that API is closed — see
    // docs/adr/0004-course-round-identity.md.
    id: serial("id").primaryKey(),
    courseCode: text("course_code")
      .notNull()
      .references(() => courses.code, {
        onDelete: "restrict",
        onUpdate: "no action",
      }),
    startTerm: integer("start_term").notNull(), // e.g. 20252
    studyPace: integer("study_pace"), // percentage, e.g. 50
    schemaUrl: text("schema_url"),
    language: text("language"),
    tutoringForm: text("tutoring_form"), // "NML (Normal) or DST (Distance)"
    tutoringTimeOfDay: text("tutoring_time_of_day"), // "DAG (Day-time) or KVÄ (evenings)"
    formattedPeriodsAndCredits: text("formatted_periods_and_credits"), // e.g. "P1 (7,5 hp)"
    isPU: boolean("is_pu").notNull(), // Part of KTH programme
    isVU: boolean("is_vu").notNull(), // open course
  },
  (table) => [
    check("study_pace_range", sql`${table.studyPace} between 1 and 100`),
    index("course_rounds_course_code_idx").on(table.courseCode),
  ],
);

export type InsertCourseRound = typeof courseRounds.$inferInsert;
export type SelectCourseRound = typeof courseRounds.$inferSelect;

// courseExaminations stores the examination components for a course.
// e.g. DD2421 has TEN1 (Tentamen, 6hp, AF) and LAB1 (Laborationer, 1.5hp, PF)
export const courseExaminations = pgTable(
  "course_examinations",
  {
    courseCode: text("course_code")
      .notNull()
      .references(() => courses.code, {
        onDelete: "restrict",
        onUpdate: "no action",
      }),
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
      .references(() => courses.code, {
        onDelete: "restrict",
        onUpdate: "no action",
      }),
    prerequisiteCourseCode: text("prerequisite_course_code")
      .notNull()
      .references(() => courses.code, {
        onDelete: "restrict",
        onUpdate: "no action",
      }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.courseCode, table.prerequisiteCourseCode],
    }),
    index("course_prerequisites_prerequisite_course_code_idx").on(
      table.prerequisiteCourseCode,
    ),
  ],
);

export type InsertCoursePrerequisite = typeof coursePrerequisites.$inferInsert;
export type SelectCoursePrerequisite = typeof coursePrerequisites.$inferSelect;

export const courseExplore = pgTable(
  "course_explore",
  {
    courseCode: text("course_code")
      .primaryKey()
      .references(() => courses.code, {
        onDelete: "cascade",
        onUpdate: "no action",
      }),
    embedding: vector("embedding", { dimensions: 1536 }),
    sourceHash: text("source_hash"),
    searchVector: tsvector("search_vector"),
    embeddingModel: text("embedding_model"),
    embeddedAt: timestamp("embedded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("course_explore_search_vector_idx").using("gin", table.searchVector),
    index("course_explore_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);

export type InsertCourseExplore = typeof courseExplore.$inferInsert;
export type SelectCourseExplore = typeof courseExplore.$inferSelect;

export const userSavedCourses = pgTable(
  "user_saved_courses",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "no action",
      }),
    courseCode: text("course_code")
      .notNull()
      .references(() => courses.code, {
        onDelete: "restrict",
        onUpdate: "no action",
      }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.courseCode] }),
    index("user_saved_courses_course_code_idx").on(table.courseCode),
  ],
);

export type InsertUserSavedCourse = typeof userSavedCourses.$inferInsert;
export type SelectUserSavedCourse = typeof userSavedCourses.$inferSelect;

export const userTakenCourses = pgTable(
  "user_taken_courses",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "no action",
      }),
    courseCode: text("course_code")
      .notNull()
      .references(() => courses.code, {
        onDelete: "restrict",
        onUpdate: "no action",
      }),
    attendancePeriods: text("attendance_periods"),
    attendanceYear: integer("attendance_year"),
    grade: text("grade"),
    earnedCredits: real("earned_credits"),
    transcriptImportedAt: timestamp("transcript_imported_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.courseCode] }),
    index("user_taken_courses_course_code_idx").on(table.courseCode),
  ],
);

export type InsertUserTakenCourse = typeof userTakenCourses.$inferInsert;
export type SelectUserTakenCourse = typeof userTakenCourses.$inferSelect;

export const collections = pgTable(
  "collections",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "no action",
      }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("collections_id_user_id_unique").on(table.id, table.userId),
    index("collections_user_id_idx").on(table.userId),
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.collectionId, table.courseCode] }),
    foreignKey({
      name: "collection_courses_collection_owner_fk",
      columns: [table.collectionId, table.collectionUserId],
      foreignColumns: [collections.id, collections.userId],
    }).onDelete("cascade"),
    foreignKey({
      name: "collection_courses_saved_course_fk",
      columns: [table.collectionUserId, table.courseCode],
      foreignColumns: [userSavedCourses.userId, userSavedCourses.courseCode],
    }).onDelete("cascade"),
    check("position_nonnegative", sql`${table.position} >= 0`),
    index("collection_courses_collection_owner_idx").on(
      table.collectionId,
      table.collectionUserId,
    ),
    index("collection_courses_saved_course_idx").on(
      table.collectionUserId,
      table.courseCode,
    ),
  ],
);

export type InsertCollectionCourse = typeof collectionCourses.$inferInsert;
export type SelectCollectionCourse = typeof collectionCourses.$inferSelect;

export const usersGraphNodes = pgTable("users_graph_nodes", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, {
      onDelete: "cascade",
      onUpdate: "no action",
    }),
  x: doublePrecision("x").notNull(),
  y: doublePrecision("y").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type InsertUsersGraphNode = typeof usersGraphNodes.$inferInsert;
export type SelectUsersGraphNode = typeof usersGraphNodes.$inferSelect;

export const usersGraphBackboneEdges = pgTable(
  "users_graph_backbone_edges",
  {
    nodeUserId: text("node_user_id")
      .notNull()
      .references(() => usersGraphNodes.userId, {
        onDelete: "cascade",
        onUpdate: "no action",
      }),
    anchorUserId: text("anchor_user_id")
      .notNull()
      .references(() => usersGraphNodes.userId, {
        onDelete: "cascade",
        onUpdate: "no action",
      }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.nodeUserId, table.anchorUserId] }),
    check(
      "no_self_backbone_edge",
      sql`${table.nodeUserId} <> ${table.anchorUserId}`,
    ),
    index("users_graph_backbone_edges_anchor_user_id_idx").on(
      table.anchorUserId,
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
    .references(() => users.id, {
      onDelete: "cascade",
      onUpdate: "no action",
    }),
  color: text("color").default("default").notNull(),
  style: nodeStyle("style").default("default").notNull(),
  signalStyle: nodeSignalStyle("signal_style").default("default").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type InsertUsersNodeProfile = typeof usersNodeProfiles.$inferInsert;
export type SelectUsersNodeProfile = typeof usersNodeProfiles.$inferSelect;

// --- REVIEW / FORUM TABLES ----------------
// table for reviews that references users (posters) and courses (reviewed)
export const reviews = pgTable(
  "reviews",
  {
    id: text("id").primaryKey(), // review id
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }), // foreign key to users table
    courseCode: text("course_code")
      .notNull()
      .references(() => courses.code, {
        onDelete: "restrict",
        onUpdate: "no action",
      }), // foreign key to courses table

    // Self-reported recollection. Null is the stored answer for "I don't
    // remember" — never a zero-filled distribution or a zero percentage.
    examinationDistribution: jsonb(
      "examination_distribution",
    ).$type<ExaminationDistribution>(),
    approachTheoryPercent: integer("approach_theory_percent"),

    // Two separate axes, each 1-10. Neither is an overall verdict.
    workloadScore: integer("workload_score").notNull(),
    learningScore: integer("learning_score").notNull(),

    happyTook: boolean("happy_took").notNull(),
    message: text("message"),

    // timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "approach_theory_percent_range",
      sql`${table.approachTheoryPercent} between 0 and 100`,
    ),
    check("workload_score_range", sql`${table.workloadScore} between 1 and 10`),
    check("learning_score_range", sql`${table.learningScore} between 1 and 10`),
    index("reviews_user_id_idx").on(table.userId),
    index("reviews_course_code_idx").on(table.courseCode),
  ],
);

export type InsertReview = typeof reviews.$inferInsert;
export type SelectReview = typeof reviews.$inferSelect;

export const reviewVotes = pgTable(
  "review_votes",
  {
    voterUserId: text("voter_user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "no action",
      }),
    reviewId: text("review_id")
      .notNull()
      .references(() => reviews.id, {
        onDelete: "cascade",
        onUpdate: "no action",
      }),
    voteType: reviewVoteType("vote_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.voterUserId, table.reviewId] }),
    index("review_votes_review_id_idx").on(table.reviewId),
  ],
);

export type InsertReviewVote = typeof reviewVotes.$inferInsert;
export type SelectReviewVote = typeof reviewVotes.$inferSelect;

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
