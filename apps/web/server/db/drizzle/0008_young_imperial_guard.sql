ALTER TABLE "reviews" DROP CONSTRAINT "reviews_course_code_courses_code_fk";
--> statement-breakpoint
ALTER TABLE "course_rounds" ADD COLUMN "round_code" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_course_code_courses_code_fk" FOREIGN KEY ("course_code") REFERENCES "public"."courses"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "course_rounds_course_code_round_code_unique" ON "course_rounds" USING btree ("course_code","round_code") WHERE "course_rounds"."round_code" is not null;