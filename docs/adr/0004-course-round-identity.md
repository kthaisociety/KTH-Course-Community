# 4. Course round identity: keep the serial id, drop round_code

Date: 2026-09-04

## Status

Accepted. Supersedes the `course_rounds` primary key decision in
`docs/schema_docs/current-schema-decisions.md`.

## Context

The approved target keyed `course_rounds` on `(course_code, round_code)`, where
`round_code` was to hold KOPPS `round.ladokUID`. Migration `0006` added the
column as nullable on purpose and deferred the key change, noting that the
serial `id` is not stable across re-ingestion and that the final change "must
follow a source-backed round rebuild, never `id::text`".

That rebuild is no longer possible. **The KOPPS API is closed.** The 2320 rows
now in `course_rounds` are all the round data there will be, `round_code` was
never populated, and `ladokUID` is unobtainable.

Two facts settle what to do instead.

**No key derivable from the retained data identifies a round.** Uniqueness fails
at every level short of the whole row:

| Candidate key | Colliding groups | Excess rows |
| --- | ---: | ---: |
| `(course_code, start_term)` | 184 | 215 |
| `+ language, tutoring_form, tutoring_time_of_day, is_pu, is_vu` | 77 | 104 |
| every column except `id` | 4 | 4 |

Only `ladokUID` ever separated those 77 groups. So a composite key cannot
deliver the guarantee it was chosen for — one round per course per offering.

**A synthetic `round_code` would be the id under another name.** Setting
`round_code = id::text` makes `(course_code, round_code)` unique by
construction, not by meaning: a second column, a NOT NULL and a key swap bought
for a constraint that constrains nothing. A generated UUID is worse still — it
discards the identity the rows already have and is not reproducible. The `0006`
objection to `id::text` was specifically instability across re-ingestion, and
with the source closed there is no re-ingestion.

Nothing depends on the current key. No foreign key references `course_rounds`,
and no application code selects `id` or `round_code` — every query in
`server/course/repository.ts` filters by `course_code` and reads descriptive
fields.

## Decision

`course_rounds` keys on its serial `id`. `round_code` is removed from the
schema, the canonical planned schema, and the schema documents, and the column
is dropped from the database by migration `0010`.

The drop ships here rather than with the wider legacy cleanup because it has no
prerequisite: the column is NULL on every row, no foreign key or query
references it, and nothing has to be rewired first. Deferring it would leave
the Drizzle model and the database disagreeing for no benefit.

`schema_url` is retained. It embeds KTH's own subgroup slug
(`.../subgroup/ht-2025-555/...`), present and distinct on 1831 of 2320 rows,
which is the only real round identifier still in the data. Keeping it means a
meaningful round code remains derivable if a source ever reappears, so this
decision forecloses nothing.

## Consequences

- Rounds cannot be addressed by a stable external identifier. Acceptable: they
  are only ever listed under a course.
- Duplicate rounds are not prevented by the schema. Four rows are already
  identical to another row on every column but `id`. Whether those are
  ingestion artefacts or genuinely parallel rounds cannot be determined from
  the retained data.
- `course_rounds` needs nothing from the later contract migration: no key swap,
  no NOT NULL, and no re-ingest prerequisite. Migration `0010` also drops the
  partial unique index `course_rounds_course_code_round_code_unique`, which
  only ever guarded an always-NULL column.
- The Lucid diagram is the visual authority for the planned schema and still
  shows the composite key. **It needs the matching edit**; this ADR and
  `planned-schema-lucid.json` record the intent until it does.
- The ingest pipeline reads KOPPS and can no longer refresh anything. The
  `ladokUID` field and its `round_code` mapping are removed from
  `server/ingest/`. The wider question of what ingest means with the source
  closed is not settled here.
