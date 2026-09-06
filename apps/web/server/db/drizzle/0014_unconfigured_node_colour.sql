-- Every node goes back to the unconfigured colour (#68, item 3).
--
-- Placement used to hash each app user onto one of six palette names, so every
-- profile carries a colour nobody chose while the colour axis is locked for
-- everybody: nothing writes users.personalization_tier_earned, so every account
-- sits at tier 0. `users_node_profiles.color` already defaults to 'default';
-- this discards the override on the rows written before placement stopped
-- applying it. Nothing a person picked is lost, because nothing here was picked.
--
-- Data only: no column, constraint or default changes, so the schema snapshot
-- beside this file is 0013's unchanged.
UPDATE "users_node_profiles"
SET "color" = 'default',
	"updated_at" = now()
WHERE "color" <> 'default';
