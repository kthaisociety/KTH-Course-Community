# 12. Ingest from KTH's course pages, keep the KOPPS rounds

Date: 2026-11-15

## Status

Accepted. Amends one consequence of ADR 0004, that ingest "can no longer
refresh anything", and nothing else in it.

## Context

KOPPS v2 (`api.kth.se/api/kopps/v2`) answers 404 on every endpoint, so
`bun run ingest` has failed since it closed. ADR 0004 recorded the closure and
left open what ingest means without a source.

KTH's own course pages still carry everything ingest mapped from KOPPS, as JSON
the page embeds for its client:

| Need | Source |
| --- | --- |
| Department codes | `/student/kurser/org`, `window.__compressedApplicationStore__` |
| Course codes | `/student/kurser/intern-api/sok/sv?department=XX` |
| Course, syllabi, rounds | `/student/kurser/kurs/:code?l=sv\|en`, `window.__compressedData__DATA` |

On 2026-11-15 this listed 4,799 courses in 27 s, and 1,516 of them mapped
through `CourseDetailSchema` without a failure. One page per language per
course; no HTML is scraped.

Two properties of this source shape the decision.

**It is undocumented.** The search endpoint is named `intern-api`, and the
embedded JSON is whatever KTH's frontend needs. Either can change without
notice.

**It lists current terms only.** A course page shows rounds for its active
semesters, and 674 of 1,516 sampled courses showed none. The 2,320 rounds now
in `course_rounds` came from KOPPS and cannot be fetched again (ADR 0004).
`upsertRounds` deleted every round of an ingested course before inserting, so
the first run against this source would have deleted that history.

## Decision

`server/ingest/kth-web.ts` replaces `kopps.ts` as ingest's source. It produces
the KOPPS shapes `schemas.ts` already defines, so the mapping in `ingest.ts`
and the database schema are unchanged.

- **Every payload is validated with zod** (`CoursePageSchema`,
  `CourseSearchResponseSchema`), so a change on KTH's side fails the course
  loudly instead of writing wrong rows.
- **Rounds are replaced per term, not per course.** The detail carries
  `coveredRoundTerms`, the start terms the page reported rounds for, cancelled
  ones included. `upsertRounds` deletes a course's rows for those terms only.
  Rows for any other term, the KOPPS history among them, are never touched.
- **The stored state is the course page's.** The course list cannot tell an
  established course from a discontinued one, so `ingest.ts` now writes
  `detail.course.state` rather than the list's placeholder.
- **The course list is built in two passes, then joined with the catalogue.**
  Searching by department missed 21 of 300 courses in the committed KOPPS
  sample (`server/derive/__fixtures__/corpus.json`). Eight are still current:
  courses owned by a school-level code such as `J` (DA232X), which the search
  answers with "overflow", or one /org does not list, such as `TG` (VS2010).
  The second pass searches by code pattern, starting from every
  two-character prefix seen in the first pass or in the catalogue, and
  splitting a pattern answered with "overflow" until it fits. A three-character
  pattern answered with "unknown" is split once (AI3 answers it while AI30
  lists 24 courses); a longer one is taken as empty, because "unknown" also
  answers empty prefixes at every length and following it doubled the queries
  without finding a course. A full run then adds every catalogue
  code the list still lacks and re-reads its page. That covers the other 13: they are discontinued, which the search never lists, and their
  pages now report them so, so they become `DEACTIVATED` instead of staying
  `ESTABLISHED` for good.
- **Nothing defaults silently.** Unparseable credits, an unknown level code, an
  examination line that does not parse, a failed English page and a search
  error are each logged with the course or department code.

## Consequences

- Ingest refreshes again. A full run makes about 9,600 page requests.
- Values are mapped onto KOPPS's vocabulary where it is known: level codes
  (`1` to `BASIC`, `2` to `ADVANCED`, `3` to `RESEARCH`, `99` to
  `PREPARATORY`) and grade scales (`AF`, `PF`; anything else is stored as KTH
  writes it).
- **Some round values are inferred, not verified against KOPPS data.**
  Tutoring form and time are stored as `Normal`/`Distans` and
  `Dagtid`/`Kvällstid`, `isPU` means the round belongs to a programme, and
  `isVU` means KTH shows an application link. Rows written by KOPPS may use
  other spellings; comparing them with a fresh run settles it. The comments in
  `types/course.ts` and `db/schema.ts` describe codes (`NML`, `DAG`), which
  neither source stores.
- Examinations still upsert on `(course_code, exam_code)`, so a component that
  disappears from the syllabus stays in the table, as it did under KOPPS.
- A new course is found only if its two-character prefix is already known to
  the first pass or the catalogue. A course in an entirely new prefix family,
  owned by a code the department search cannot reach, is missed until one of
  those learns the prefix.
- A catalogue course whose page no longer answers is skipped with a warning
  and its row left as it is.
- When KTH changes its frontend, `kth-web.ts` is the one file to fix; the zod
  errors in the ingest log say which field moved.
