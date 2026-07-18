CREATE TABLE "user_courses" (
	"user_id" text NOT NULL,
	"course_code" text NOT NULL,
	"grade" text,
	"credits" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_courses_user_id_course_code_pk" PRIMARY KEY("user_id","course_code")
);
--> statement-breakpoint
ALTER TABLE "user_courses" ADD CONSTRAINT "user_courses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_courses" ADD CONSTRAINT "user_courses_course_code_courses_code_fk" FOREIGN KEY ("course_code") REFERENCES "public"."courses"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courses_embedding_idx" ON "courses" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courses_name_trgm_idx" ON "courses" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courses_code_trgm_idx" ON "courses" USING gin ("code" gin_trgm_ops);