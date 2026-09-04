ALTER TABLE "reviews" ALTER COLUMN "happy_took" SET DEFAULT NULL;--> statement-breakpoint

-- Temporary expand/contract compatibility. Each trigger below is dropped by
-- the issue that owns its domain, once that repository writes the target
-- tables and columns: the review triggers (reviews_legacy_target_sync,
-- review_likes_target_sync) belong to #75, user_favorites_target_sync to #64,
-- and courses_explore_target_sync to #77.
CREATE OR REPLACE FUNCTION "sync_legacy_review_fields_to_target"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
	legacy_insert boolean;
BEGIN
	IF TG_OP = 'INSERT' THEN
		legacy_insert := NEW."workload_score" IS NULL
			AND NEW."learning_score" IS NULL
			AND NEW."happy_took" IS NULL;
		-- NULL means the target field was omitted; explicit target values win.
		IF NEW."workload_score" IS NULL THEN
			NEW."workload_score" := CASE
				WHEN NEW."workload" BETWEEN 1 AND 10 THEN NEW."workload"
				ELSE NULL
			END;
		END IF;
		IF NEW."learning_score" IS NULL THEN
			NEW."learning_score" := CASE
				WHEN NEW."learning_experience" BETWEEN 1 AND 10
					THEN NEW."learning_experience"
				ELSE NULL
			END;
		END IF;
		IF NEW."happy_took" IS NULL THEN
			NEW."happy_took" := NEW."would_recommend";
		END IF;
		IF legacy_insert AND NEW."message" IS NULL THEN
			NEW."message" := NULLIF(NEW."content", '');
		END IF;
	ELSE
		-- A target-only update must not be replaced by unchanged legacy values.
		IF NEW."workload" IS DISTINCT FROM OLD."workload" THEN
			NEW."workload_score" := CASE
				WHEN NEW."workload" BETWEEN 1 AND 10 THEN NEW."workload"
				ELSE NULL
			END;
		END IF;
		IF NEW."learning_experience" IS DISTINCT FROM OLD."learning_experience" THEN
			NEW."learning_score" := CASE
				WHEN NEW."learning_experience" BETWEEN 1 AND 10
					THEN NEW."learning_experience"
				ELSE NULL
			END;
		END IF;
		IF NEW."would_recommend" IS DISTINCT FROM OLD."would_recommend" THEN
			NEW."happy_took" := NEW."would_recommend";
		END IF;
		IF NEW."content" IS DISTINCT FROM OLD."content" THEN
			NEW."message" := NULLIF(NEW."content", '');
		END IF;
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE FUNCTION "sync_user_favorites_to_saved_courses"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		DELETE FROM "user_saved_courses"
		WHERE "user_id" = OLD."user_id"
			AND "course_code" = OLD."fav_course_code";
		RETURN OLD;
	END IF;

	IF TG_OP = 'UPDATE'
		AND (NEW."user_id", NEW."fav_course_code")
			IS DISTINCT FROM (OLD."user_id", OLD."fav_course_code") THEN
		DELETE FROM "user_saved_courses"
		WHERE "user_id" = OLD."user_id"
			AND "course_code" = OLD."fav_course_code";
	END IF;

	INSERT INTO "user_saved_courses" ("user_id", "course_code", "created_at")
	VALUES (NEW."user_id", NEW."fav_course_code", NEW."created_at")
	ON CONFLICT ("user_id", "course_code") DO UPDATE
	SET "created_at" = EXCLUDED."created_at";
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "user_favorites_target_sync"
AFTER INSERT OR UPDATE OR DELETE
ON "user_favorites"
FOR EACH ROW
EXECUTE FUNCTION "sync_user_favorites_to_saved_courses"();--> statement-breakpoint

CREATE FUNCTION "sync_review_likes_to_votes"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
	target_vote_type "review_vote_type";
BEGIN
	IF TG_OP = 'DELETE' THEN
		DELETE FROM "review_votes"
		WHERE "voter_user_id" = OLD."user_id"
			AND "review_id" = OLD."review_id";
		RETURN OLD;
	END IF;

	target_vote_type := CASE NEW."vote_type"
		WHEN 'like' THEN 'up'::"review_vote_type"
		WHEN 'dislike' THEN 'down'::"review_vote_type"
		ELSE NULL
	END;
	IF target_vote_type IS NULL THEN
		RAISE EXCEPTION 'Unsupported legacy review vote type: %', NEW."vote_type";
	END IF;

	IF TG_OP = 'UPDATE'
		AND (NEW."user_id", NEW."review_id")
			IS DISTINCT FROM (OLD."user_id", OLD."review_id") THEN
		DELETE FROM "review_votes"
		WHERE "voter_user_id" = OLD."user_id"
			AND "review_id" = OLD."review_id";
	END IF;

	INSERT INTO "review_votes" (
		"voter_user_id",
		"review_id",
		"vote_type",
		"created_at",
		"updated_at"
	)
	VALUES (
		NEW."user_id",
		NEW."review_id",
		target_vote_type,
		NEW."created_at",
		now()
	)
	ON CONFLICT ("voter_user_id", "review_id") DO UPDATE
	SET
		"vote_type" = EXCLUDED."vote_type",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "review_likes_target_sync"
AFTER INSERT OR UPDATE OR DELETE
ON "review_likes"
FOR EACH ROW
EXECUTE FUNCTION "sync_review_likes_to_votes"();--> statement-breakpoint

CREATE FUNCTION "sync_courses_to_course_explore"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		DELETE FROM "course_explore" WHERE "course_code" = OLD."code";
		RETURN OLD;
	END IF;

	IF TG_OP = 'UPDATE' AND NEW."code" IS DISTINCT FROM OLD."code" THEN
		DELETE FROM "course_explore" WHERE "course_code" = OLD."code";
	END IF;

	INSERT INTO "course_explore" (
		"course_code",
		"embedding",
		"source_hash",
		"search_vector",
		"embedding_model",
		"embedded_at"
	)
	VALUES (
		NEW."code",
		NEW."embedding",
		NEW."embedding_hash",
		NEW."search_vector",
		CASE
			WHEN NEW."embedding" IS NOT NULL THEN 'openai/text-embedding-3-small'
			ELSE NULL
		END,
		CASE WHEN NEW."embedding" IS NOT NULL THEN now() ELSE NULL END
	)
	ON CONFLICT ("course_code") DO UPDATE
	SET
		"embedding" = EXCLUDED."embedding",
		"source_hash" = EXCLUDED."source_hash",
		"search_vector" = EXCLUDED."search_vector",
		"embedding_model" = EXCLUDED."embedding_model",
		"embedded_at" = CASE
			WHEN "course_explore"."embedding" IS DISTINCT FROM EXCLUDED."embedding"
				OR "course_explore"."source_hash" IS DISTINCT FROM EXCLUDED."source_hash"
			THEN EXCLUDED."embedded_at"
			ELSE "course_explore"."embedded_at"
		END,
		"updated_at" = now();
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "courses_explore_target_sync"
AFTER INSERT OR UPDATE OF
	"code",
	"name_english",
	"name_swedish",
	"goals",
	"content",
	"embedding",
	"embedding_hash"
OR DELETE
ON "courses"
FOR EACH ROW
EXECUTE FUNCTION "sync_courses_to_course_explore"();
