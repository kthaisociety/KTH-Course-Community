-- LEGACY: kept for historical reference only.
-- Use 0000_baseline_current_schema.sql for active schema bootstrap.
CREATE TYPE "public"."course_state" AS ENUM('CANCELLED', 'ESTABLISHED', 'DEACTIVATED');--> statement-breakpoint
CREATE TABLE "courses" (
	"code" text PRIMARY KEY NOT NULL,
	"department" text NOT NULL,
	"name" text NOT NULL,
	"state" "course_state" NOT NULL,
	"last_examination_semester" text,
	"credits" real,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
CREATE TABLE "review_likes" (
	"user_id" text NOT NULL,
	"review_id" text NOT NULL,
	"vote_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_likes_user_id_review_id_pk" PRIMARY KEY("user_id","review_id")
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"course_code" text NOT NULL,
	"easy_score" integer DEFAULT 0 NOT NULL,
	"useful_score" integer DEFAULT 0 NOT NULL,
	"interesting_score" integer DEFAULT 0 NOT NULL,
	"would_recommend" boolean DEFAULT false NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_favorites" (
	"user_id" text NOT NULL,
	"fav_course_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_favorites_user_id_fav_course_code_pk" PRIMARY KEY("user_id","fav_course_code")
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
ALTER TABLE "review_likes" ADD CONSTRAINT "review_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_likes" ADD CONSTRAINT "review_likes_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_course_code_courses_code_fk" FOREIGN KEY ("course_code") REFERENCES "public"."courses"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_favorites" ADD CONSTRAINT "user_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_favorites" ADD CONSTRAINT "user_favorites_fav_course_code_courses_code_fk" FOREIGN KEY ("fav_course_code") REFERENCES "public"."courses"("code") ON DELETE cascade ON UPDATE no action;