-- Retires "favorite" (ADR 0003). Every application writer now goes through
-- server/saved, so the expand/contract bridge added in 0009 has no readers left
-- and the legacy table can go with it. Ordered last in this migration set: the
-- code that stopped writing user_favorites ships in the same pull request.
--
-- Deliberately unguarded: no IF EXISTS, no CASCADE. If any of these objects is
-- missing, or anything still depends on the table, this migration must fail
-- loudly rather than drop something nobody accounted for.
DROP TRIGGER "user_favorites_target_sync" ON "user_favorites";--> statement-breakpoint
DROP FUNCTION "sync_user_favorites_to_saved_courses"();--> statement-breakpoint
DROP TABLE "user_favorites";
