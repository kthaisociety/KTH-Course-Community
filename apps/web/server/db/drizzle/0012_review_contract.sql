-- Contract phase for the review domain (#75). The application now reads and
-- writes only the target columns and `review_votes`, so the expand-phase
-- compatibility triggers from 0006/0009 have no remaining writer and the
-- legacy review columns and `review_likes` can go.
--
-- Fail before touching anything if a legacy row would be lost. `reviews` is
-- empty today; if that has changed, a zero-valued legacy score never became a
-- valid 1-10 target score and the abandoned `examination_methods` /
-- `theoretical_vs_applied` integers do not convert. Both need a deliberate
-- decision rather than a silent default.
DO $$
DECLARE
	unscored bigint;
BEGIN
	SELECT count(*) INTO unscored
	FROM "reviews"
	WHERE "workload_score" IS NULL
		OR "learning_score" IS NULL
		OR "happy_took" IS NULL;

	IF unscored > 0 THEN
		RAISE EXCEPTION
			'Cannot contract reviews: % row(s) have no target score. Decide how to score them before running this migration.',
			unscored;
	END IF;
END;
$$;--> statement-breakpoint

DROP TRIGGER IF EXISTS "reviews_legacy_target_sync" ON "reviews";--> statement-breakpoint
DROP FUNCTION IF EXISTS "sync_legacy_review_fields_to_target"();--> statement-breakpoint
DROP TRIGGER IF EXISTS "review_likes_target_sync" ON "review_likes";--> statement-breakpoint
DROP FUNCTION IF EXISTS "sync_review_likes_to_votes"();--> statement-breakpoint

ALTER TABLE "reviews" ALTER COLUMN "workload_score" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "learning_score" SET NOT NULL;--> statement-breakpoint
-- 0009 set this to DEFAULT NULL so the sync trigger could tell an omitted
-- target value from an explicit one. With the trigger gone the column is
-- simply required.
ALTER TABLE "reviews" ALTER COLUMN "happy_took" DROP DEFAULT;--> statement-breakpoint

ALTER TABLE "reviews" DROP COLUMN "examination_methods";--> statement-breakpoint
ALTER TABLE "reviews" DROP COLUMN "theoretical_vs_applied";--> statement-breakpoint
ALTER TABLE "reviews" DROP COLUMN "workload";--> statement-breakpoint
ALTER TABLE "reviews" DROP COLUMN "learning_experience";--> statement-breakpoint
ALTER TABLE "reviews" DROP COLUMN "would_recommend";--> statement-breakpoint
ALTER TABLE "reviews" DROP COLUMN "content";--> statement-breakpoint

DROP TABLE "review_likes" CASCADE;
