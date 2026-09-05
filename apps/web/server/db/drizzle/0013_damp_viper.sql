-- Contract phase for course search state (#77). Search and ingest now use
-- course_explore directly, so the compatibility trigger from 0009 and the
-- four legacy course columns can be removed.
--
-- Refuse to discard the legacy copy if its authoritative target row is
-- missing. Search ingestion has written directly to course_explore since the
-- expand phase, so its values may legitimately be newer than the deprecated
-- courses mirror and must not be compared for equality here.
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "courses"
		LEFT JOIN "course_explore"
			ON "course_explore"."course_code" = "courses"."code"
		WHERE "course_explore"."course_code" IS NULL
	) THEN
		RAISE EXCEPTION 'Cannot contract courses: a course_explore target row is missing';
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
