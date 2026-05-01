-- BASELINE MIGRATION (authoritative)
-- Created: 2026-05-01
-- Purpose: Canonical bootstrap for current Drizzle schema.
-- Source of truth: src/db/schema.ts
-- This file defines the current schema represented by src/db/schema.ts.
-- Legacy chain files are kept for historical reference only.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE "public"."course_state" AS ENUM('CANCELLED', 'ESTABLISHED', 'DEACTIVATED');--> statement-breakpoint

CREATE TABLE "courses" (
  "code" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "name_swedish" text NOT NULL,
  "name_english" text NOT NULL,
  "state" "course_state" NOT NULL,
  "credits" real NOT NULL,
  "credit_unit" text,
  "department_code" text NOT NULL,
  "department" text NOT NULL,
  "educational_level_code" text,
  "grade_scale_code" text,
  "goals" text,
  "content" text,
  "eligibility" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "embedding" vector(1536),
  "embedding_hash" text,
  "search_vector" tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce(name_english, '') || ' ' || coalesce(name_swedish, '') || ' ' || coalesce(code, '') || ' ' || coalesce(goals, '') || ' ' || coalesce(content, ''))) STORED
);
--> statement-breakpoint

CREATE TABLE "course_rounds" (
  "id" serial PRIMARY KEY NOT NULL,
  "course_code" text NOT NULL,
  "start_term" integer NOT NULL,
  "study_pace" integer,
  "schema_url" text,
  "language" text,
  "tutoring_form" text,
  "tutoring_time_of_day" text,
  "formatted_periods_and_credits" text,
  "is_pu" boolean NOT NULL,
  "is_vu" boolean NOT NULL
);
--> statement-breakpoint

CREATE TABLE "course_examinations" (
  "course_code" text NOT NULL,
  "exam_code" text NOT NULL,
  "title" text,
  "credits" real,
  "grade_scale_code" text,
  CONSTRAINT "course_examinations_course_code_exam_code_pk" PRIMARY KEY("course_code","exam_code")
);
--> statement-breakpoint

CREATE TABLE "users" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "name" text NOT NULL,
  "profile_picture" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint

CREATE TABLE "user_auth_identities" (
  "auth_user_id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "reviews" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "course_code" text NOT NULL,
  "examination_methods" integer DEFAULT 0 NOT NULL,
  "theoretical_vs_applied" integer DEFAULT 0 NOT NULL,
  "workload" integer DEFAULT 0 NOT NULL,
  "learning_experience" integer DEFAULT 0 NOT NULL,
  "would_recommend" boolean DEFAULT false NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "review_likes" (
  "user_id" text NOT NULL,
  "review_id" text NOT NULL,
  "vote_type" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "review_likes_user_id_review_id_pk" PRIMARY KEY("user_id","review_id")
);
--> statement-breakpoint

CREATE TABLE "user_favorites" (
  "user_id" text NOT NULL,
  "fav_course_code" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "user_favorites_user_id_fav_course_code_pk" PRIMARY KEY("user_id","fav_course_code")
);
--> statement-breakpoint

CREATE TABLE "feedback_form" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "message" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "course_rounds" ADD CONSTRAINT "course_rounds_course_code_courses_code_fk" FOREIGN KEY ("course_code") REFERENCES "public"."courses"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_examinations" ADD CONSTRAINT "course_examinations_course_code_courses_code_fk" FOREIGN KEY ("course_code") REFERENCES "public"."courses"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_auth_identities" ADD CONSTRAINT "user_auth_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_course_code_courses_code_fk" FOREIGN KEY ("course_code") REFERENCES "public"."courses"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_likes" ADD CONSTRAINT "review_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_likes" ADD CONSTRAINT "review_likes_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_favorites" ADD CONSTRAINT "user_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_favorites" ADD CONSTRAINT "user_favorites_fav_course_code_courses_code_fk" FOREIGN KEY ("fav_course_code") REFERENCES "public"."courses"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "courses_search_vector_idx" ON "courses" USING gin ("search_vector");
