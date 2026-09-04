CREATE TABLE "course_keywords" (
	"course_code" text NOT NULL,
	"keyword_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_keywords_course_code_keyword_id_pk" PRIMARY KEY("course_code","keyword_id")
);
--> statement-breakpoint
CREATE TABLE "keywords" (
	"id" serial PRIMARY KEY NOT NULL,
	"term" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "keywords_term_unique" UNIQUE("term")
);
--> statement-breakpoint
ALTER TABLE "course_explore" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "course_explore" ADD COLUMN "summary_version" text;--> statement-breakpoint
ALTER TABLE "course_explore" ADD COLUMN "summary_generated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "course_explore" ADD COLUMN "eligibility_version" text;--> statement-breakpoint
ALTER TABLE "course_explore" ADD COLUMN "eligibility_extracted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "course_keywords" ADD CONSTRAINT "course_keywords_course_code_courses_code_fk" FOREIGN KEY ("course_code") REFERENCES "public"."courses"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_keywords" ADD CONSTRAINT "course_keywords_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "public"."keywords"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "course_keywords_keyword_id_idx" ON "course_keywords" USING btree ("keyword_id");