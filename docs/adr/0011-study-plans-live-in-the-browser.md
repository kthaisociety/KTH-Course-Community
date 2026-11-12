# 11. Study plans live in the browser, and programme syllabi are files

Date: 2026-11-11

## Status

Accepted.

## Context

The study plan (`/plan`) needs two kinds of data the schema doesn't hold.

1. **Each student's plan.** This is which course they intend to take in which period. The
   schema is frozen for now, so there can be no `study_plans` table.
2. **KTH's programme syllabi.** These are the mandatory and elective courses per study
   year and intake. They also hold:
   - the master's programmes each civilingenjör intake maps;
   - each master's entry requirements;
   - each degree project's credit bar;
   - the periods each course runs in for the programme;
   - every round of each course this academic year, from the course's own page.

   The catalogue's `course_rounds` holds 2025/26 only, truncated to one term. A
   programme's year page lists only that programme's round. IA150X shows why both fall
   short: CINTE takes it P3–P4 at 50 %, and its course page also lists P1, P2 and P4
   alone at 100 %.

   KOPPS, which once served some of this, is closed (ADR 0004). kth.se still publishes
   all of it on public pages, as the JSON each page renders from.

## Decision

**The plan lives in `localStorage`.** It uses one key per fact, owner first:
`kth-cc:plan:<owner>:at:<code>`. This follows `saved/lib/guest-saves.ts`, so two tabs
never overwrite each other's courses. Nothing from Taken is copied in: taken courses
are read from the account on every render. The plan stores only the student's own
intentions:

- placements;
- courses they left out;
- checks they dismissed.

Export and import of a JSON file is the only backup.

**Programme syllabi are generated files, committed under `server/programme/data/`.**
`bun run ingest:programmes` builds them from kth.se, about 2,400 public pages per run. The `programme` domain serves them
read-only through tRPC, and `next.config.ts` traces the folder into the standalone
build. The app makes no request to kth.se at runtime.

## Consequences

- **A plan is per browser.** A student who signs in on another device starts empty
  until they import their export. A table removes this. The key layout maps one to one
  onto `study_plans`, `study_plan_courses` and `study_plan_left_out`, so moving reuses
  Saved's guest-import pattern.
- **The data is as fresh as its last ingest.** Re-run it when a new intake's syllabus
  is published, and every August for the new academic year's periods. Year pages carry
  periods only for the running year, so the period template for year N comes from the
  cohort admitted N−1 years ago.
- **Some facts are text, not data, and stay text.** Mapped master's programmes, entry
  requirements and degree-project bars are read from KTH's prose, and the plan shows
  KTH's sentence next to any number read from it. Fifteen master's programmes publish
  exact course codes for civilingenjör students, and those are checked exactly. The
  others are matched by course title and labelled as an estimate.
- **One fact was hand-written:** that TCOMM, TSEDM and TINNM are replaced by TSDSM and
  TICEM. It comes from KTH's "Masterprogram 2027" notice, which no page encodes as data.
  It lives in `server/ingest/programmes/build.ts` with its source.
