# Current database-schema decisions

Updated: 2026-09-01  
Status: approved target design; migrations have not yet been written or applied.

## Sources of truth

1. [Lucidchart planned schema](https://lucid.app/lucidchart/80b5e812-7b9d-44a7-b0d4-10bdd87941fb/edit?viewport_loc=1847%2C1804%2C805%2C512%2C0_0&invitationId=inv_4fe92980-e309-403d-b227-7c5ec1f1c7fd) is the visual target and relationship diagram.
2. [`planned-schema-lucid.json`](planned-schema-lucid.json) is the canonical, reviewable machine-readable transcription used to prepare Drizzle and SQL migrations.
3. [`planned-database-formats.md`](planned-database-formats.md) explains implementation rules and unresolved operational choices.

The old TSV export was removed. It duplicated the JSON, could not represent composite constraints reliably, and had become stale. Generate any future tabular view from the canonical JSON instead of maintaining another schema copy.

## Approved structural decisions

- Keep the source course domain normalized into `courses`, `course_rounds`, and `course_examinations`.
- Key `course_rounds` on its serial `id`. The natural `(course_code, round_code)` key
  required KOPPS `round.ladokUID`; that API is closed, the column was never populated,
  and no key derivable from the retained data separates parallel rounds. Superseded by
  [ADR 0004](../adr/0004-course-round-identity.md).
- Keep search data in the one-to-one `course_explore` table rather than `courses`; it is derived and rebuildable.
- Keep `user_saved_courses` and `user_taken_courses` separate. Saved and taken are independent relationships.
- A collection course must be saved by the collection owner. `collection_courses` therefore has two separate composite foreign keys:
  - `(collection_id, collection_user_id) -> collections(id, user_id)`
  - `(collection_user_id, course_code) -> user_saved_courses(user_id, course_code)`
- `collections` has `UNIQUE (id, user_id)` so the first composite FK has a valid referenced key.
- `collection_courses` has composite PK `(collection_id, course_code)`.
- `users_graph_nodes` is a one-to-one extension of `users`: `user_id` is both its PK and FK to `users.id`, and `x`/`y` are persistent world coordinates.
- `users_node_profiles` is a separate one-to-one extension containing required `color`, `style`, and `signal_style` values.
- `users_graph_backbone_edges` has composite PK `(node_user_id, anchor_user_id)`. Both columns independently reference `users_graph_nodes.user_id`; the stored direction records the newer node and its older anchor, while the frontend may render the connection as undirected.
- `users.personalization_tier_earned` is a required small integer from 0 through 3 with default 0. Any inactivity-based effective tier is derived behavior and does not overwrite the earned tier.
- `user_taken_courses` remains catalog-only. It references `courses.code`, does not duplicate a localized course name, and records transcript provenance with nullable `transcript_imported_at` rather than an `in_transcript` boolean.
- `course_prerequisites` has composite PK `(course_code, prerequisite_course_code)`. Its two columns are independent FKs to `courses.code`.
- `course_examinations` has composite PK `(course_code, exam_code)`; exam codes are not globally unique.
- `review_votes` has composite PK `(voter_user_id, review_id)` and enum values `up` and `down`.
- `reviews.happy_took` is a required boolean answer attached to the published review. It is not stored on `user_taken_courses`.
- Reviews may store a nullable self-reported `examination_distribution` JSON value. Choosing “I don’t remember” stores `NULL`. This review response is distinct from the source examination rows in `course_examinations` and from any derived course-level classification.
- `reviews.approach_theory_percent` is also nullable; “I don’t remember” stores `NULL` rather than zero.
- `reviews.message` is nullable. A reviewer may submit scores and `happy_took` without writing a comment; that stores `NULL` rather than an empty string.
- `feedback_form` remains independent of authentication.

## Approved checks

- `collection_courses.position >= 0`
- `course_rounds.study_pace BETWEEN 1 AND 100` when non-null
- `users.personalization_tier_earned BETWEEN 0 AND 3`
- `users_graph_backbone_edges.node_user_id <> anchor_user_id`
- `reviews.approach_theory_percent BETWEEN 0 AND 100`
- `reviews.workload_score BETWEEN 1 AND 10`
- `reviews.learning_score BETWEEN 1 AND 10`

## Migration plan

Create a data-containing Neon child branch from the current database and run all development migrations there. Retained rows do not need to be re-ingested merely because obsolete columns are dropped.

Derive the migration from the actual branch schema compared with the canonical target—not from the diagram alone. Prefer rename/type-conversion operations that preserve data, backfill before adding `NOT NULL`, validate existing rows before adding constraints, and drop obsolete columns last. The committed SQL migrations, not the Neon database branch itself, are later applied to production.

Keep the branch connection string and gateway key in ignored, server-only environment files. Never commit credentials.

## Schema authority and drift detection

Before the initial target migration is accepted, the Lucidchart diagram defines the planned database structure and `planned-schema-lucid.json` is its canonical machine-readable transcription.

After the initial migration reaches that target, authority changes:

- The committed Drizzle schema and ordered SQL migrations become the executable source of truth.
- Neon is the deployed database state and must not be changed manually outside the migration workflow.
- Lucidchart remains reviewed architectural documentation rather than a second writable schema authority.
- `planned-schema-lucid.json` remains a reviewable documentation snapshot; it should be generated or checked from the executable schema when practical instead of independently edited.

Future schema changes should follow this pull-request workflow:

1. Change the Drizzle schema and add an explicit SQL migration.
2. Apply the migrations to an isolated Neon branch created for the change.
3. Review Neon Schema Diff against the parent/production branch.
4. Update the canonical JSON and Lucidchart to describe the resulting structure.
5. Merge only after application code, migration result, and documentation agree.
6. Apply the committed migration to production; do not promote an undocumented manual database edit.

Drift checks report differences but never overwrite either system automatically:

- **Database drift:** periodically build an expected Neon branch from committed migrations and compare it with the deployed branch. If they differ, fail CI or open an issue instructing maintainers to create a migration or revert the manual database change.
- **Lucidchart drift:** periodically retrieve and normalize the Lucid document contents through its read-only API and compare a stored snapshot or hash. If it changed, open an issue requesting semantic review and corresponding schema/migration updates.
- A Lucid-content difference only proves that the diagram changed; it does not prove a meaningful SQL-schema difference. Connector and layout changes require human review.

Recommended pull-request checks are: migrations apply cleanly to a fresh Neon branch, Neon posts the branch schema diff, the resulting database agrees with the Drizzle schema, the canonical JSON is updated, and the Lucidchart revision is reviewed. Direct two-way synchronization is intentionally rejected because conflicts would have no reliable automatic authority.

## Still to decide during migration implementation

- Exact `ON DELETE`/`ON UPDATE` actions and account-deletion retention behavior.
- Exact allowed values and defaults for `node_style`, `node_signal_style`, and node colors.
- How effective personalization-tier decay is calculated and surfaced without mutating `personalization_tier_earned`.
- Whether `attendance_periods` and integer `attendance_year` should later be consolidated into a single term representation; the canonical target currently follows the Lucidchart fields exactly.
- Exact defaults and mechanism for maintaining `updated_at`.
- Search-vector refresh mechanism and vector-index choice after confirming the embedding model and dimension.
- Whether credits remain `real` for compatibility or move to exact `numeric` after auditing stored values.
- Better Auth-managed account, session, and verification tables; these are outside this application-domain diagram.
