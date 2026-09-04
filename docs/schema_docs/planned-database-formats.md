# Planned database target

Updated: 2026-09-04. This document explains the approved Lucidchart target. The exact column inventory and constraints live in [`planned-schema-lucid.json`](planned-schema-lucid.json).

## Conventions

- PostgreSQL names use `snake_case`.
- Existing identifiers and KTH codes remain `text`; do not convert them to UUID columns without a compatibility audit.
- Required timestamps use `timestamptz`. `created_at` normally defaults to `now()`; an `updated_at` default does not automatically maintain it.
- Nullable means unknown or absent. Do not encode missing values as an empty string, zero, or `false`.
- Primary and unique constraints enforce identity. Index referencing FK columns used for joins because PostgreSQL does not automatically index every referencing side.
- Constraint labels in Lucidchart are explanatory: `PK`, `FK`, `UQ`, and `CK`. A shared labeled arrow is one composite FK; independent arrows are independent FKs.

## Course domain

`courses` contains canonical imported course information. The redundant legacy `name` and search columns are absent from the target.

`course_rounds` keys on its serial `id` and retains source offering data. `study_pace` is optional and checked from 1 through 100. `schema_url` is retained: it embeds KTH's own subgroup slug (`.../subgroup/ht-2025-555/...`), which is the only real round identifier still present in the data. See [ADR 0004](../adr/0004-course-round-identity.md).

`course_examinations` retains original source codes, titles, credits, and grade scales. `(course_code, exam_code)` is the PK. Do not treat an exam code as a globally unique examination method.

`course_prerequisites` represents directed extracted relationships and preserves `courses.eligibility` for full source prose. It cannot express complex AND/OR eligibility logic.

`course_explore` contains all derived per-course state keyed one-to-one by `course_code`; full-text and semantic-search state are one part of that wider charter. `search_vector` and `embedding` serve different retrieval modes and are not duplicates. The source hash prevents unnecessary search regeneration, while model and embedding timestamps make generated search values traceable. `vector(1536)` follows the embedding model in `apps/web/server/ai.ts` (`openai/text-embedding-3-small`) and matches the previously shipped `courses.embedding` column, so the width carries over unchanged. Changing embedding models later is a re-embed, not a column tweak — `embedding_model` and `embedded_at` exist to make that generation traceable. Create GIN and vector indexes after the extension and data strategy are settled.

`keywords` is the controlled vocabulary and `course_keywords` assigns its terms to courses relationally. Zero keywords for a course is a legal outcome; the vocabulary must not force a bad match merely to create an assignment. Version strings track prompt- and model-driven staleness; they do not prove freshness when source fields change. The dormant KOPPS ingest path still conflict-updates `courses`, so it or any replacement importer must invalidate dependent derivations in the same transaction before it is safe to run after derived data has been populated. A change to `goals` or `content` clears `summary`, `summary_version`, and `summary_generated_at` and removes the course's `course_keywords` rows. A change to `eligibility` clears `eligibility_version` and `eligibility_extracted_at` and removes the course's `course_prerequisites` rows. The cleared version/timestamp marks the derivation as not current until its stage reruns. `course_explore.source_hash` remains specific to full-text and semantic-search input and is not reused for this invalidation contract.

## Saved and user domains

Saved state is row existence in `user_saved_courses`; taken state is row existence in `user_taken_courses`. Removing a save must not remove taken history or reviews.

`user_taken_courses` contains only catalog courses and keeps the composite PK `(user_id, course_code)`. Course names are localized from `courses.name_swedish`/`name_english`, not copied into the relationship. `transcript_imported_at` is nullable and records that the row was present in a successful transcript import; manually entered catalog courses may remain null. Imported grade, credit, and attendance fields are still user-editable/self-reported data. Whether the student is happy they took a course belongs to the published review and is not stored on this relationship.

`collection_courses` deliberately repeats the owner ID so PostgreSQL can enforce both collection ownership and saved-course membership with its two composite FKs. It has no direct FK to `courses`, because the referenced `user_saved_courses` row already guarantees that course.

`users_graph_nodes` stores one persistent world-space position per user. Its `user_id` is both PK and FK to `users.id`; no separate node identifier is needed while every graph node represents a user.

`users_graph_backbone_edges` stores stable placement anchors. `(node_user_id, anchor_user_id)` is its composite PK, each endpoint is an independent FK, and self-edges are rejected. Direction records placement history (newer node to older anchor), not a one-way relationship in the UI. New users should receive a bounded set of stable anchors without globally repositioning established users.

`users_node_profiles` separates node appearance from graph topology. `color`, `style`, and `signal_style` are required in the current diagram, so migrations must define valid defaults or backfill them before adding `NOT NULL`. The exact custom-type values remain a product decision.

`users.personalization_tier_earned` stores the highest earned tier from 0 through 3. The effective tier shown by the product may decay by one for every complete six months without a qualifying review, but that derived value does not replace the earned value in this schema.

## Reviews and feedback

Reviews store nullable self-reported examination distribution, nullable theory/practice approach, required workload and learning scores, a required `happy_took` answer, and nullable message content. “I don’t remember” is represented by `NULL`, never by a zero-filled distribution or zero percentage, and a reviewer who leaves no written comment likewise stores `NULL` rather than an empty string. Workload and learning use the 1–10 scale in both database checks and service validation.

`reviews.examination_distribution` is review data, not a replacement for `course_examinations`. The latter retains authoritative source codes/titles/credits, while the former records a student's remembered relative mix. Validate the JSON shape and total in the service until a database-level JSON constraint is deliberately specified.

Review votes are one row per voter/review with enum `up` or `down`; absence means no vote. UI toggle behavior should use idempotent set/remove operations. A self-voting policy remains an application decision.

`feedback_form` accepts standalone contact submissions and intentionally has no user FK.

## Examination-method classification

Course-level classification remains a derived-data concern and is not a separate table in the approved 18-table target; the two-table increase from the prior target is the relational controlled vocabulary in `keywords` and `course_keywords`. Broad labels are Exam, Assignments, Labs, Projects, Seminars/participation, and Other/unspecified. Classify normalized source code/title pairs, use titles as the primary signal, retain original titles, allow mixed labels, and never infer final-exam timing or workload shares.

If mappings are persisted later, design a separate versioned mapping table or artifact after evaluating the classifier. Do not add model guesses to `course_examinations` source columns.

## Implementation gates

Before production migration: inspect the current Neon schema and data, check new constraints against existing rows, decide referential actions, confirm the pgvector extension is enabled on the target branch, and generate the Drizzle schema plus explicit SQL migrations. Test those migrations first on an isolated data-containing Neon branch.
