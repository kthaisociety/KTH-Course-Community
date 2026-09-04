# Corpus census — what is actually in `courses.goals`, `content` and `eligibility`

Read 2026-09-04 against the production Neon database, at commit `48bb338`. Owned by
[#101](https://github.com/kthaisociety/KTH-Course-Community/issues/101); the map it unblocks is
[#73](https://github.com/kthaisociety/KTH-Course-Community/issues/73).

KOPPS is deactivated. These three columns are the only copy of KTH's syllabus prose that still
exists, and nothing in the derive map may overwrite them. This document is a read; it changes
nothing.

The 300-course sample the numbers below were sanity-checked against is committed at
[`apps/web/server/derive/__fixtures__/corpus.json`](../../apps/web/server/derive/__fixtures__/corpus.json).

## Method

Every number comes from one pass over all 4644 rows. Two derived views are used throughout:

- **raw** — the bytes as stored, HTML tags and numeric entities intact.
- **plain** — entities decoded, tags replaced by a space, whitespace collapsed. Computed on read
  and never persisted; the map forbids stored normalisation.

Language detection is deterministic — no model, no network. Over the plain text, hits from a
Swedish marker list and an English marker list are counted (function words plus the syllabus
vocabulary that saturates this corpus: `motsvarande`, `behörighet`, `kunskaper`, `slutförd`, and
their English counterparts). The larger count wins. Single letters are ignored, because course
codes leave stray letters behind (`5A1227` would otherwise score as the English article `a`). On a
tie — which here almost always means a terse phrase carrying no marker words at all — the presence
of å, ä or ö decides. Only a tie with no Swedish letter is reported as undetermined.

The detector's error character, from hand-checking samples of each label: it labels a bilingual row
by whichever half is longer (`EF1113` holds a Swedish sentence followed by its English translation
and is scored English), and a bare Swedish noun phrase with no marker word and no Swedish letter
falls to undetermined (`Matematik 4`, `Engelska 6`). Both failures are conservative — they
understate the Swedish share.

## The corpus

| | |
|---|---|
| rows in `courses` | 4644 |
| rows by `state` | `ESTABLISHED` 4644 — **there is only one state** |
| distinct `department_code` | 100 |

The single-state result is worth naming: the `course_state` enum admits `CANCELLED` and
`DEACTIVATED` as well, and nothing in the database uses either. Any derive pass that filters
on state is filtering on nothing.

## Field presence

The three columns are nullable in Drizzle, but **no row is null**. Absence is stored as the empty
string — which the schema conventions in `planned-database-formats.md` explicitly rule out
("Do not encode missing values as an empty string"). The ingest wrote `?? ""`. Nothing in this map
fixes it; it is recorded here so the next person does not write `IS NOT NULL` and get 4644 rows.

| field | present | absent (`''`) | null |
|---|---|---|---|
| `goals` | 4374 (94.2%) | 270 | 0 |
| `content` | 4364 (94.0%) | 280 | 0 |
| `eligibility` | 3980 (85.7%) | 664 | 0 |

254 courses have neither `goals` nor `content`. 239 have none of the three.

## Length

Characters. "raw" includes markup and entity escapes; "plain" is what a prompt would actually see.

| field | view | min | median | p90 | max | total |
|---|---|---|---|---|---|---|
| `goals` | raw | 26 | 795 | 1588 | 5897 | 3.88 M |
| `goals` | plain | 19 | 624 | 1253 | 4944 | 3.05 M |
| `content` | raw | 22 | 616 | 1449 | 6372 | 3.29 M |
| `content` | plain | 10 | 500 | 1191 | 5601 | 2.68 M |
| `eligibility` | raw | 8 | 134 | 475 | 2297 | 0.79 M |
| `eligibility` | plain | 1 | 109 | 396 | 1752 | 0.64 M |

Markup and entity escapes are **20% of the stored bytes** of `goals` and `content`. Stage A's input
is `goals + content`: 5.73 M plain characters across the 4390 courses that have any, a median of
**1184 plain characters** per course (p90 2194, max 6530) — call it 300 tokens plus the prompt.
That is the number the cost estimate in #73 was missing. Stage B's whole input is 0.64 M plain
characters, median 109.

## Language

**This is the number the map deferred and nobody had.** Per field, over rows where the field is
present:

| field | Swedish | English | undetermined |
|---|---|---|---|
| `goals` | 4184 (95.7%) | 189 (4.3%) | 1 (0.0%) |
| `content` | 4161 (95.3%) | 196 (4.5%) | 7 (0.2%) |
| `eligibility` | 3724 (93.6%) | 143 (3.6%) | 113 (2.8%) |

Per course, across whichever of the three fields are present: **4165 entirely Swedish, 174 entirely
English, 66 mixed**, 239 with nothing to classify. 113 of the 4644 courses have a `name_english`
identical to `name_swedish`, so even the titles are not uniformly translated.

The translation burden is therefore close to total: **about 96% of the corpus is Swedish**, and the
English 4% is concentrated in doctoral (`F…`) and master's-level courses. There is no partial path
where stage A reads a mostly-English corpus. Every prompt in this map is a translation prompt as
well as a summarisation one, and the 66 mixed-language courses mean a per-course language flag
would be wrong for some of them — the prompt has to handle mixed input rather than be switched on a
detected language.

## HTML

**Every** non-empty value contains at least one tag — 100% of rows in all three fields. The
inventory is small and closed:

| field | tags, by occurrence |
|---|---|
| `goals` | `<li>` 31210 / 2780 rows · `<p>` 23982 / 4286 · `<ul>` 6198 / 2437 · `<br>` 1041 / 228 · `<ol>` 726 / 357 · `<em>` 320 / 54 · `<strong>` 134 / 33 |
| `content` | `<p>` 20208 / 3868 · `<li>` 18084 / 1239 · `<ul>` 3004 / 1180 · `<br>` 1129 / 233 · `<em>` 562 / 95 · `<strong>` 462 / 67 · `<ol>` 142 / 65 |
| `eligibility` | `<p>` 11348 / 3879 · `<li>` 1204 / 205 · `<br>` 462 / 263 · `<ul>` 454 / 203 · `<strong>` 232 / 83 · `<em>` 102 / 36 · `<ol>` 6 / 3 |

Seven tags, all of them structural or light emphasis. No tables, no anchors, no images, no
attributes worth keeping. A seven-tag allowlist covers the corpus exactly.

The surprise is the entities. **97% of `goals` and `content` rows and 86% of `eligibility` rows
contain HTML entities, and they are overwhelmingly numeric escapes for the Swedish alphabet** —
`&#246;` (ö) 38851 times in `goals` alone, `&#228;` (ä) 37935, `&#229;` (å) 24256. 46 distinct
entities in `goals`, 65 in `content`, 25 in `eligibility`. `&#160;` (non-breaking space) appears
11565 times in `goals`, usually in runs of eight faking a bullet indent, alongside `&#183;` (·) and
`&#8226;` (•) used as literal bullet characters inside `<p>` rather than as list markup.

Two consequences:

1. **Decoding entities is not optional, and it must happen before anything else.** A pipeline that
   strips tags but leaves entities feeds the model `f&#246;r` instead of `för` — and, as this
   census found the hard way, breaks any word-level analysis of Swedish text.
2. `course_explore.search_vector` is built from raw `goals`/`content` (`server/ingest/ingest.ts`
   composes the text, `server/ingest/repository.ts` runs `to_tsvector`), so the full-text index
   currently contains tokens like `246` and `160`. Out of scope here; it belongs to
   [#74](https://github.com/kthaisociety/KTH-Course-Community/issues/74).

## Empty embedding input

The embedding input is `[code, titleEng, titleSwe, goals, content].filter(Boolean).join(" ")`
(`server/ingest/ingest.ts`). `code`, `name_english` and `name_swedish` are `NOT NULL`, so:

- Courses whose embedding input is **literally empty: 0.**
- Courses whose embedding input carries **no prose at all** — identifiers and titles only:
  **254 (5.5%)**. These embed a bare title against a corpus of full syllabi.

254 is also the exact count of courses stage A cannot run on, and 664 (14.3%) is the count stage B
cannot run on. Both stages need a defined no-input outcome, not an error.

## What eligibility prose actually looks like

Fifty-plus rows read by hand, spread evenly across the catalogue by course code. This is the
qualitative read [#73](https://github.com/kthaisociety/KTH-Course-Community/issues/73) blocked
stage B on.

### Explicit course codes are the minority

**Only 33.5% of eligibility rows name a course code at all** (1335 of 3980). Of the 2645 that do
not, 1996 also contain no `motsvarande` — no course and no equivalence of any kind, just a credit
threshold, a degree, or an admission status. This is the single most important structural fact
for stage C: **two thirds of the corpus will produce zero prerequisite edges, and that is the
correct outcome, not a failure.**

Where codes do appear they cluster. 467 rows name exactly one, 356 name two, and the tail runs to
31 codes in a single row — programme-wide "all of year 1–3" statements listed out. 4335 occurrences
in total, 1059 distinct code tokens.

A plain regex is enough, and it already has a measurable signal: `\b[A-Z]{2}[0-9]{3,4}[A-Z]?\b`
matched 4335 tokens, of which **3681 (84.9%) resolve to a row in `courses`**. Every KTH code in the
corpus fits that one shape — a broader alternative for `AB12CD`-style codes matched nothing. The
654 that do not are not regex noise: they are real KTH codes for discontinued courses (`ID1020`
×42, `DD1312` ×22, `SF1924` ×19). 74% of code-bearing rows have every one of
their references resolve. Stage C's "fraction of extracted references that resolve" metric therefore
has a deterministic baseline of 85% before any model is involved; a model that does worse than the
regex is not earning its cost.

### The phrasing is templated, and the template is recent

729 of the 1335 code-bearing rows write the code immediately followed by its title —
`AI1520 Plan, bygg- och miljörätt vid fastighetsutveckling`. The dominant modern template is:

> Kunskaper i envariabelanalys, 7,5 hp, motsvarande slutförd kurs SF1625.

403 rows open with `Kunskaper i …` / `Kunskaper och färdigheter i …`, and 203 use
`motsvarande slutförd kurs` to introduce the code. The requirement is stated as *knowledge*, with a
named course given as one way of having it — so the code is an example, not the requirement.
125 rows extend it with the boilerplate `Aktivt deltagande i kursomgång vars slutexamination ännu
inte är Ladokrapporterad jämställs med slutförd kurs`, which carries no requirement at all and
should be dropped, not extracted.

Older rows use terser forms: a bare list under `Avklarade kurser:` (28 rows), or just the codes and
titles run together with no verb at all (`AF1021: "Hus och anläggningar Byggmaterial grundkurs
Byggfysik …"` — titles only, no codes, and unrecoverable without fuzzy title matching).

Two syntaxes will trip a naive extractor:

- **slash alternatives** — `DD1337/DD1310-DD1319/DD1321/DD1331/DD100N/ID1018`, in 180 rows. These
  are *alternatives*: any one satisfies the requirement.
- **hyphen ranges** — `DD1310-DD1319`, in 72 rows, meaning every code in that numeric span. The
  hyphen is a range, not a pair, and the endpoints are frequently discontinued courses.

`eller motsvarande` ("or equivalent") appears in 368 code-bearing rows and 1472 rows overall
(37%). It is the corpus's universal escape hatch and it is what makes eligibility unresolvable in
general: the requirement is explicitly *not* limited to the codes named.

### Most requirements are not courses at all

Over all 3980 rows:

| requirement | rows |
|---|---|
| a credit threshold in hp (`Minst 180 hp inom …`) | 813 (20.4%) |
| upper-secondary English (`Engelska B` / `Engelska 6`) | 676 (17.0%) |
| a prior degree (kandidat-/master-/civilingenjörsexamen, B.Sc., M.Sc.) | 632 (15.9%) |
| programme or year-of-study membership (`årskurs 1`, `CMETE1`, `ARKIT`) | 614 (15.4%) |
| formal admission eligibility (`grundläggande`/`särskild behörighet`) | 439 (11.0%) |
| doctoral admission (`Antagen till forskarutbildning`, `doktorand`) | 401 (10.1%) |
| upper-secondary Matematik / Fysik / Kemi with a level number | 91 / 71 |
| work experience | 11 |
| explicitly no requirement (`Ingen.`, `Inga.`) | 30 |

The doctoral block is nearly uniform and nearly contentless — `Antagen till forskarutbildning.` and
variants. Roughly 10% of the corpus's eligibility text says only "be a PhD student", which stage B
should recognise and emit nothing for.

### Shape

88.6% of eligibility values are a single `<p>` with no list or line-break markup; the median is one
sentence, and 16.2% of rows are 40 plain characters or fewer. 9.9% run past 400 characters, and
those are almost all degree-project rows (`…210X`, `…212X`), which share a boilerplate paragraph
about completed years 1–3 and 60 advanced credits.

### Swedish and English forms differ in kind, not just language

The 143 English rows are not translations of the Swedish ones — no row holds both languages except
the handful of genuinely bilingual values. They are structurally different requirements, because
they belong to different courses: English eligibility is written for international master's and
doctoral admission and reads as degree prose —

> A completed Bachelor's degree in engineering, science, economics, planning or a similar degree…
> MSc in electrical engineering, physical engineering or similar

Code-naming rates are nonetheless almost identical (37.8% English vs 33.6% Swedish), so a
code-extraction regex needs no per-language handling. What does differ is everything around the
code: `or equivalent` appears in 23 rows against 368 for `eller motsvarande`, there is no English
counterpart to the `Kunskaper i …, 7,5 hp, motsvarande slutförd kurs …` template, and the
upper-secondary requirements (`Engelska 6`, `Matematik 3c`) are a Swedish-system concept with no
English form in the corpus at all. A stage B prompt written only against Swedish examples will
handle the English rows; one written only against English examples will miss the dominant template
entirely.

## The fixture

300 courses at
[`apps/web/server/derive/__fixtures__/corpus.json`](../../apps/web/server/derive/__fixtures__/corpus.json),
with `code`, `departmentCode`, `titleSwe`, `titleEng`, `goals`, `content` and `eligibility` stored
verbatim — tags and entities untouched, so it is a faithful stand-in for a `SELECT`.
`departmentCode` is carried beyond the six fields #101 asked for so the department spread is
checkable from a test rather than asserted in prose.

**Why `server/derive/__fixtures__/` and not `docs/schema_docs/`.** The fixture's stated job is to be
loaded and re-loaded by prompt-iteration code, and the ticket requires it to be loadable from a
test. `docs/` holds prose for humans; a 600 KB JSON blob read by Vitest is source, and it belongs
next to the domain that will read it. The folder is created empty of everything else — the `derive`
domain itself arrives in a later ticket.

Sampling is deterministic — fixed order by course code, fixed quotas taken in a fixed priority
order, even spacing within each pool — so regenerating it against the same database reproduces the
same 300 rows. The quotas are minimums drawn in this order (English 40, mixed 20, no prose 12, no
eligibility 12, code-heavy 25, long code-free eligibility 20, terse eligibility 20, then the six
length extremes), after which a department round-robin fills the sample to 300. Strata overlap, so
what actually landed is larger than the quota in most rows:

| stratum | in the sample |
|---|---|
| entirely English syllabus | 48 |
| mixed-language syllabus | 24 |
| entirely Swedish syllabus | 202 |
| too short in every field to classify | 26 |
| no prose at all (`goals` and `content` both empty) | 28 |
| no eligibility | 66 |
| eligibility naming ≥ 1 course code | 74 |
| eligibility naming ≥ 5 course codes | 32 |
| eligibility ≥ 400 plain chars naming no code | 32 |
| eligibility ≤ 40 plain chars | 44 |
| distinct department codes | 100 of 100 |

English is deliberately over-sampled — at its true 3.7% a 300-row sample would hold eleven English
courses, too few to iterate a prompt against.

`apps/web/server/derive/__fixtures__/corpus.spec.ts` asserts the count, code uniqueness, full
department coverage, that the prose is still raw, and that each edge stratum survived.

## What this changes for the map

1. **The translation burden is the whole corpus, not a slice.** ~96% Swedish. Stage A's prompt is a
   Swedish→English task on essentially every row, and 66 courses mix the two languages within one
   syllabus.
2. **Entity decoding must precede everything.** Not stripping tags — decoding `&#229;`. It is a
   read-time step, so it does not violate the map's no-stored-normalisation rule.
3. **Stage C's ceiling is one third of the catalogue.** 33.5% of eligibility rows name a code;
   a regex already resolves 84.9% of the tokens it finds. Zero edges is the majority outcome.
4. **`eller motsvarande` (37% of rows) means eligibility is not a closed set**, which is the
   strongest evidence yet for the map's decision to extract phrases without resolving them.
5. **Both derive stages need a defined empty-input outcome** — 254 courses for A, 664 for B.
6. **Filtering on `state` is meaningless.** Every row is `ESTABLISHED`.
7. **Absence is `''`, not `NULL`**, in all three columns, against the schema doc's own convention.
