# 5. Earning the personalization tier: the ladder, one derivation, and a monotonic column

Date: 2026-09-05

## Status

Accepted. Settles the ladder half of #161; the axis half — which personalization
axis each tier unlocks — is still open and is **not** decided here.

## Context

`users.personalization_tier_earned` shipped with a default of 0, a
`between 0 and 3` check constraint, and no writer. Every account therefore sat at
tier 0 and all three personalization axes rendered locked. That was never an
oversight in the code: nothing had ever decided what earns a tier, so there was
nothing for a writer to write.

Two constraints shaped the answer.

**`CONTEXT.md` already defines the column as "the highest value ever reached".**
Inactivity decay exists, but it is derived at read time by `deriveEffectiveTier`
and never written back. So whatever the writer computes, the column may only
rise.

**There must be one definition of "unreviewed".** The #134 cross-route audit
found a duplicated `ReviewDraft` decoder that silently dropped fields. The
"courses you have taken but not reviewed" arithmetic already existed as
`selectUnreviewedCourses`, used by the Taken courses and My Page cards; the top
tier is the same question asked of transcript-imported courses. A second copy —
in particular one written as a SQL anti-join — would be the same defect waiting
to happen, and the two copies would disagree in the worst possible place: the UI
telling a member they had finished while the tier said they had not.

## Decision

**The ladder.** `deriveEarnedTier` in `apps/web/server/graph/tier.ts`:

| Tier | Earned by |
| ---: | --- |
| 1 | The app user has published a review. |
| 2 | At least one `user_taken_courses` row has `transcript_imported_at` set. |
| 3 | Every transcript-imported course has a review by them, **and** there is at least one imported course. |

Each rung is tested on its own and the highest that holds wins, rather than
every lower rung having to hold too. This matters in one case: somebody who
imports a transcript before writing anything is at 2, not held at 0. Reading it
the other way would make the plain statement "tier 2 is an imported transcript"
false.

Manual entry earns neither 2 nor 3. The tier rewards the upload specifically,
because that is the data `transcript_imported_at` can vouch for. Tier 3 requires
at least one imported course so that an empty import cannot make "all reviewed"
vacuously true.

**The rule lives beside the decay formula**, in `graph/tier.ts`, because earning
and decay are one policy seen from two ends and product should be able to change
either without touching a service or a query.

**One derivation, reachable from both halves of the codebase.**
`selectUnreviewedCourses` moved to `apps/web/server/reviews/unreviewed.ts` — the
reviews domain owns the concept, and `server/` is the side the client can import
from while Biome forbids the reverse. `features/reviews/lib/unreviewed.ts`
re-exports it, so every existing client import path is unchanged.
`server/reviews/unreviewed.spec.ts` asserts the two are the same function
object, so a re-implementation fails a test rather than drifting quietly.

**The column only ever rises, in SQL.** `raiseEarnedTier` writes
`greatest(personalization_tier_earned, tier)`. That is where the guarantee has
to live: two contributions landing at once cannot have the slower one write a
stale smaller number over the faster one's. It matters because **tier 3's
condition is not monotonic** — importing a further transcript leaves imported
courses unreviewed again, and the rule will answer 2 where it once answered 3.
The earned tier still stands. The asymmetry is deliberate and is written down at
the rule, the writer and the repository so that nobody later "fixes" it.

**When the writer runs.** In the same request as the write that could raise the
tier, immediately after it commits: publishing a review
(`reviews/service.ts`) and confirming a transcript import
(`ingest/transcript/service.ts`). Not a background job, which would leave a
member looking at a locked axis for the job's period; not a read-time write,
which the tier design forbids. Deliberately *not* inside the write's own
transaction: that would mean the reviews repository reading `user_taken_courses`
and writing `users`, and the `greatest` already makes the recompute idempotent
and order-independent, so the atomicity would buy nothing. It swallows and logs
its own failures, like `joinCommunityGraphOnSignUp` — a published review stays
published even when a cosmetic number does not land.

Deletion is not a trigger. Removing a review or an imported course can only make
a *lower* tier true, and the column does not go down.

## Releasing this: the backfill is an operator step

The writer only fires on a **new** contribution, so every app user who reviewed
or imported before it shipped is still at the column default. `bun run
backfill:tiers` recomputes them: it walks only the app users who could earn
anything, pages on the user id, derives through the same `deriveEarnedTier`, and
raises through the same `greatest`, so it is safe to re-run at any time and a
second run raises nothing.

**Run it once, from a checkout, immediately after this ships.**

It is an operator step rather than a deployment step because this repo has no
deployment step to hang it on, and cannot grow one here. `Dockerfile.web`'s
runtime stage is `node:20-alpine` carrying only the Next standalone output — no
bun, no `scripts/`, no `drizzle-kit` — and `.github/workflows/docker-build-push.yml`
builds and pushes an image without ever reaching a database. Every schema change
this project has shipped, including migration `0014` and the one that created
this column, was applied by an operator running `bun run db:push` from a
checkout. The backfill is the same class of operation and takes the same path.

Automating it is worth doing and is a separate decision: it means either putting
bun and the source into the runtime image, or giving the build workflow a
production `DATABASE_URL`. Both are release-engineering choices about credentials
and image size, not personalization ones, and neither belongs in the change that
introduced the writer.

## Consequences

- Members can now reach tiers 1-3, so **the open half of #161 becomes urgent**:
  the My Page artboard's rendered list and `cc-store.js`'s `TIER_AXES` disagree
  about which axis tiers 2 and 3 unlock, and the code follows the rendered list
  provisionally. That was harmless while every account was at tier 0. Changing
  the pairing after members hold those tiers would take back a feature somebody
  had already unlocked, so it should be settled before this is deployed.
- `graph/repository.ts` now holds three read-only projections that cross a domain
  boundary — `findLastReviewAt`, `findReviewedCourses` and
  `findTranscriptImportedCourses` — plus the union read the backfill pages over.
  They are the documented exception, not a precedent: nothing else in the graph
  domain may reach into `reviews` or `user_taken_courses`, and none of them may
  grow a write.
- A member who publishes a review pays two extra reads and at most one write on
  that request. Accepted: it is the moment the unlock has to be visible.
- Until the backfill is run, existing contributors keep seeing locked axes. That
  is a stale display, not a wrong one — nothing is lost and nothing is granted in
  error, because the column only rises.
