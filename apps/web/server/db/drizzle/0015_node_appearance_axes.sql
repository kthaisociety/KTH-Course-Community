-- The style and signal axes get the values a member can actually choose (#68).
--
-- `node_style` and `node_signal_style` each declared exactly one value,
-- 'default', so unlocking tier 2 or 3 unlocked a set of one and nothing could
-- be picked. The names come from `server/graph/appearance.ts`, which is the one
-- definition of the vocabulary; these are what the database will now accept.
--
-- 'default' stays first and stays the column default. It is the unconfigured
-- state on every axis, and it is what a node renders as while a tier is
-- dormant — the stored pick is masked at read time, never deleted, so it comes
-- back when a qualifying review restores the tier.
--
-- **How this must be applied.** `bun run db:migrate` runs every pending
-- migration inside a single transaction (drizzle-orm's `PgDialect.migrate`
-- wraps the whole batch in `session.transaction`). PostgreSQL permits
-- `ALTER TYPE ... ADD VALUE` in a transaction block from **12** onwards,
-- provided the new value is not used in the same transaction — before 12 it
-- fails outright with "cannot run inside a transaction block". Neon is well
-- past 12, and this file only adds values: nothing here inserts, updates or
-- casts to one, so there is no same-transaction use to trip over. Do not add a
-- data statement using these values to this file; that is the one edit that
-- would break it. It belongs in a later migration.
--
-- `IF NOT EXISTS` makes a re-run a no-op rather than a duplicate_object error,
-- which matters because this migration may reach an environment where somebody
-- has already run `drizzle-kit push`.
ALTER TYPE "public"."node_signal_style" ADD VALUE IF NOT EXISTS 'fade';--> statement-breakpoint
ALTER TYPE "public"."node_signal_style" ADD VALUE IF NOT EXISTS 'comet';--> statement-breakpoint
ALTER TYPE "public"."node_signal_style" ADD VALUE IF NOT EXISTS 'dashed';--> statement-breakpoint
ALTER TYPE "public"."node_style" ADD VALUE IF NOT EXISTS 'solid';--> statement-breakpoint
ALTER TYPE "public"."node_style" ADD VALUE IF NOT EXISTS 'ring';--> statement-breakpoint
ALTER TYPE "public"."node_style" ADD VALUE IF NOT EXISTS 'diamond';
