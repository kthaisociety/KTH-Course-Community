-- Retires "favorite" (ADR 0003). Every application writer now goes through
-- server/saved, so the expand/contract bridge added in 0009 has no readers left
-- and the legacy table can go with it. Ordered last in this migration set: the
-- code that stopped writing user_favorites ships in the same pull request.
DROP TRIGGER IF EXISTS "user_favorites_target_sync" ON "user_favorites";--> statement-breakpoint
DROP FUNCTION IF EXISTS "sync_user_favorites_to_saved_courses"();--> statement-breakpoint
DROP TABLE "user_favorites" CASCADE;
