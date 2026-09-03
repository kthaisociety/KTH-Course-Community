---
status: accepted
---

# Fix one domain vocabulary and publish it as the root CONTEXT.md

The product decisions, the shipped columns and the UI copy have drifted into
three different vocabularies for the same domain. This decision fixes the words
once, in `CONTEXT.md` at the repository root, which `docs/agents/domain.md`
already directs every agent to read before exploring. It settles names only: no
migration is authorized here.

## The drift is already visible

`user_favorites` stores a course a user kept for later. The UI that renders it
says "Saved courses", "Save course" and "Remove from saved". The route says
`/favorites`. The identifiers say `favorite`. Three names, one concept, all
shipped — and nobody chose that.

The same pattern runs through reviews: `review_likes.vote_type` already stores a
vote while every name around it says like, and `reviews.would_recommend` answers
a question the product does not ask.

## Where a word and a column disagree, the word wins

The column is then scheduled for a migration against the target in
[`current-schema-decisions.md`](../schema_docs/current-schema-decisions.md). Four
calls are settled.

**Saved course.** "Favorite" is retired, and this is a retirement rather than a
rename — the distinction matters. Saving is one of three independent
relationships a user has with a course, alongside taking it and reviewing it;
"favorite" implies a preference ranking in a product whose ratings live on the
review. The rows survive, because they always meant "kept for later"; the
concept does not, because it never described what was stored. `schema.ts`
already carries the TODO, and it says the table should be *replaced*.

**Upvote** and **downvote**, never like, dislike or "helpful score". A like is
about the reviewer; a vote is about whether the review was worth reading.

**Happy took.** Whether a reviewer is glad they took a course is a different
question from whether they would advise a stranger to take it, and the answer
belongs to the published review rather than to the taken-course relationship.

**Explore** for the search-and-browse workspace. The route stays `/search`
permanently: Explore is where the user is, search is what they do there, and a
URL naming the verb is not a defect. This is the one call of the four that is
not a schema gap, so it carries no migration request.

## The glossary governs identifiers, not copy

`Visitor` avoids "guest" and `App user` avoids "member", while the shipped
landing says "Keep browsing as a guest" and "Already a member?". Both are
correct. `CONTEXT.md` governs tables, columns, types, functions and routes,
where precision compounds; reader-facing copy follows the design, where
"Visitor" would read as bureaucratic. The code already respects this line —
"guest" and "member" appear only in copy, never as an identifier — so the rule
describes existing practice rather than imposing new work.

## A `_Today_` line is a dated receipt, not a hedge

An entry whose behaviour the schema does not carry yet records what the code
actually does, so the intended word and the shipped column can be told apart.
This follows the repository's own instruction to document real behaviour rather
than intended behaviour, and it is what lets the glossary land *before* the
migration instead of after it — which matters, because the migration takes its
column names from here. Written the other way round, vocabulary would follow
implementation, which is how `fav_course_code` got its name.

Three rules keep those lines honest:

- They state only verifiable schema facts — column name, type, nullability, real
  constraints. An unenforced code comment is not a rule. `reviews.workload` and
  `reviews.learning_experience` are unconstrained integers defaulting to 0; the
  `1-5` beside them in `schema.ts` is a comment and the glossary must not repeat
  it as a constraint.
- Every line names what closes it, so a stale one is visibly overdue rather than
  quietly wrong.
- They are expected to be temporary. Each is deleted in the same pull request as
  the migration that closes it, alongside the matching code rename, so
  identifiers, columns and glossary never contradict each other mid-flight.

## The community graph is named before it is built

None of `users_graph_nodes`, `users_graph_backbone_edges`,
`users_node_profiles` or `users.personalization_tier_earned` exists. Their words
are settled anyway, by the design and by
[`personal-community-viewport.md`](../landing_docs/personal-community-viewport.md), and
every one of those entries carries a `_Today_` line saying the table is absent
and the landing hero renders a synthetic field.

Naming them first is not premature: the hero has already drifted once for want
of the words. It used "anchor" for an off-frame node carrying edges past the
viewport, colliding with **Anchor** as the placement relationship the schema
means. That rename ships with this decision.

## Consequences

- `CONTEXT.md` is a glossary and nothing else. Column inventories, constraints
  and migration sequencing stay in
  [`current-schema-decisions.md`](../schema_docs/current-schema-decisions.md) and
  [`planned-database-formats.md`](../schema_docs/planned-database-formats.md); a
  term is anchored to the schema only where its
  identity depends on a key, or in a `_Today_` line.
- The renames this implies — `user_saved_courses`, `review_votes` with an
  `up`/`down` enum, `reviews.happy_took`, 1-10 workload and learning scores,
  nullable `examination_distribution` and `approach_theory_percent` — belong to
  the schema target, not to this decision.
- Most of the glossary carries a `_Today_` line, because most of the target
  schema is unbuilt. That is the honest state and it shrinks with every
  migration.
