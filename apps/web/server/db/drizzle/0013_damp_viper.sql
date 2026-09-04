-- Contract phase for course search state (#77). Search and ingest now use
-- course_explore directly, so the compatibility trigger from 0009 and the
-- four legacy course columns can be removed.
--
-- Refuse to discard the legacy copy if the target row or any moved value has
-- drifted. The trigger should make this impossible; failing here turns a
-- broken assumption into an explicit migration error instead of data loss.
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "courses"
		LEFT JOIN "course_explore"
			ON "course_explore"."course_code" = "courses"."code"
		WHERE "course_explore"."course_code" IS NULL
			OR "course_explore"."embedding" IS DISTINCT FROM "courses"."embedding"
			OR "course_explore"."source_hash" IS DISTINCT FROM "courses"."embedding_hash"
			OR "course_explore"."search_vector" IS DISTINCT FROM "courses"."search_vector"
	) THEN
		RAISE EXCEPTION 'Cannot contract courses: course_explore search state differs from the legacy columns';
	END IF;
END
$$;--> statement-breakpoint

DROP TRIGGER "courses_explore_target_sync" ON "courses";--> statement-breakpoint
DROP FUNCTION "sync_courses_to_course_explore"();--> statement-breakpoint

DROP INDEX "courses_search_vector_idx";--> statement-breakpoint
DROP INDEX "courses_embedding_idx";--> statement-breakpoint
DROP INDEX "courses_name_trgm_idx";--> statement-breakpoint
ALTER TABLE "courses" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "courses" DROP COLUMN "embedding";--> statement-breakpoint
ALTER TABLE "courses" DROP COLUMN "embedding_hash";--> statement-breakpoint
ALTER TABLE "courses" DROP COLUMN "search_vector";
