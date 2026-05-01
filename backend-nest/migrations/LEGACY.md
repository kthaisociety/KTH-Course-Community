Legacy migration chain
======================

Legacy cutoff date: 2026-05-01
Baseline replacement: `0000_baseline_current_schema.sql`
Rationale: historical migrations drifted from current schema and are retained for reference only.

The old numbered files are kept only for historical reference:

- `0000_bitter_unicorn.sql`
- `0001_tense_black_tom.sql`
- `0002_brown_jocasta.sql`

Authoritative baseline is now:

- `0000_baseline_current_schema.sql`

Drizzle metadata (`migrations/meta/_journal.json`) points to the baseline chain.
