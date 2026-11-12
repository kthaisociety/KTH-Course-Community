import type {
  CourseLevel,
  CoursePlanFacts,
  CurrentRound,
  PeriodCredits,
  PlanCategory,
  PlanFactsResult,
  PlanRow,
  ProgrammeDetail,
} from "@/types/programme";
import type { PlanSetup, PlanState } from "./plan-storage";
import {
  intakeStart,
  nextSlot,
  type Period,
  type Slot,
  slotIndex,
} from "./slots";

/**
 * Turns the programme's syllabus, the student's taken courses and their own
 * placements into the plan's items. Pure: no I/O, and the same inputs always
 * give the same plan, so the checks and the grid can never disagree.
 *
 * Taken courses are read, never copied: a course
 * added on /taken appears here, one deleted there disappears. A mandatory
 * course lands in its syllabus period without asking. Anything else the
 * student took has no known period — the transcript doesn't say — so it waits
 * in "To place" until they drag it in.
 */

export interface TakenRow {
  courseCode: string;
  grade: string | null;
  earnedCredits: number | null;
  attendanceYear: number | null;
}

const FAILING_GRADE = /^(F|FX|U)$/i;

/**
 * Whether a taken course was passed in full. A Ladok transcript lists only passed
 * courses, but a course added by hand can carry a failing grade or partial credits.
 */
export function isPassed(t: TakenRow, courseCredits: number | null): boolean {
  if (t.grade && FAILING_GRADE.test(t.grade.trim())) return false;
  if (
    t.earnedCredits !== null &&
    courseCredits &&
    t.earnedCredits < courseCredits - 0.05
  )
    return false;
  return true;
}

/**
 * Every course the page needs facts for. It must not depend on the facts it asks
 * for: whether a taken course counts as passed depends on its credits, which come
 * from those facts, so every taken course is asked for, passed or not. Otherwise
 * a partly credited course drops out once its credits load, its facts go with
 * it, it counts as passed again, and the request never settles.
 */
export function codesNeedingFacts(
  plan: Pick<BuiltPlan, "items" | "unplaced" | "leftOut" | "electives">,
  taken: readonly TakenRow[],
  ...extra: readonly (readonly string[])[]
): string[] {
  return [
    ...new Set([
      ...[...plan.items, ...plan.unplaced, ...plan.leftOut].map((i) => i.code),
      ...plan.electives.map((e) => e.code),
      ...taken.map((t) => t.courseCode),
      ...extra.flat(),
    ]),
  ].sort();
}

export type ItemStatus =
  | "passed"
  | "not-passed"
  | "in-progress"
  | "planned"
  | "unplaced";

export interface Segment {
  slot: Slot;
  credits: number;
  /** Credits the catalogue didn't print for this round, drawn as continuing. */
  continued?: boolean;
}

export interface PlanItem {
  code: string;
  title: string;
  credits: number;
  level: CourseLevel;
  /** Where the plan got the course from. */
  source: "programme" | "master" | "own";
  /** The syllabus category, when a syllabus lists the course. */
  category: PlanCategory | null;
  mandatory: boolean;
  /**
   * The study year the syllabus puts the course in, or null for the student's own
   * picks. Credit gates such as "110 hp from years 1–2" group by this, not by
   * where the student happened to place the course.
   */
  syllabusYear: number | null;
  /** The taken course, when it was passed in full. */
  taken: TakenRow | null;
  slot: Slot | null;
  /** The student placed it, or moved it from where the syllabus puts it. */
  placedByStudent: boolean;
  segments: Segment[];
  /** Study pace of the round in use, in percent: 7.5 hp in one period is 50 %. */
  pace: number | null;
  roundSource: "programme" | "master" | "kth" | "catalogue" | "none";
  /** Periods the course's rounds start in. */
  offeredStarts: Period[];
  /** The round in use doesn't start in the placed period. */
  offPeriod: boolean;
  status: ItemStatus;
  /** Counts toward credits: passed, or still to come. */
  counts: boolean;
  startIdx: number;
  endIdx: number;
}

export interface TemplateCourse extends PlanRow {
  studyYear: number;
  source: "programme" | "master";
}

export interface PlanInputs {
  setup: PlanSetup;
  programme: ProgrammeDetail | null;
  /** A civilingenjör's chosen master's, which fills years 4–5. */
  master: ProgrammeDetail | null;
  taken: readonly TakenRow[];
  facts: PlanFactsResult;
  state: PlanState;
  now: Slot;
  /** This academic year's rounds per course, from the courses' kth.se pages. */
  currentRounds: Readonly<Record<string, CurrentRound[]>>;
  /**
   * Whether `taken` is the student's transcript. A visitor's isn't known, so
   * a course in a period that has ended is just past, not "not passed".
   */
  knowsTranscript: boolean;
}

export interface BuiltPlan {
  startAy: number | null;
  years: number;
  /** Study years the master's part covers, e.g. [4, 5]; empty when there is none. */
  masterYears: number[];
  items: PlanItem[];
  /** Taken courses with no period yet. */
  unplaced: PlanItem[];
  leftOut: PlanItem[];
  /** The syllabus's courses that are not mandatory, or are a mandatory course's alternative. */
  electives: TemplateCourse[];
  /** Every course the syllabus lists, mandatory or not, by code. */
  template: Map<string, TemplateCourse>;
  mandatory: TemplateCourse[];
  overlaps: string[][];
  /** Taken courses passed in full: what prerequisites and "done" may rely on. */
  passedCodes: string[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The intake whose syllabus applies, falling back to the nearest published one. */
export function intakeOf(detail: ProgrammeDetail | null, term: string | null) {
  if (!detail) return null;
  if (term && detail.intakes[term]) return detail.intakes[term];
  const terms = Object.keys(detail.intakes).sort();
  if (!terms.length) return null;
  if (!term) return detail.intakes[terms.at(-1) as string];
  const nearest = [...terms].sort(
    (a, b) =>
      Math.abs(Number(a) - Number(term)) - Math.abs(Number(b) - Number(term)),
  )[0];
  return detail.intakes[nearest];
}

/** The master's intake a civilingenjör student enters: the autumn three years after their own start. */
export const masterIntakeFor = (intake: string) =>
  `${Number(intake.slice(0, 4)) + 3}2`;

export const yearsOf = (detail: ProgrammeDetail | null, isCiving: boolean) =>
  isCiving ? 5 : Math.max(1, detail?.summary.years ?? 3);

function templateRows(
  detail: ProgrammeDetail | null,
  term: string | null,
  track: string | null,
  years: number[],
  source: "programme" | "master",
  yearOffset: number,
): TemplateCourse[] {
  const intake = intakeOf(detail, term);
  if (!intake) return [];
  const out: TemplateCourse[] = [];
  const seen = new Set<string>();
  for (const y of years) {
    for (const row of intake.years[String(y)] ?? []) {
      if (row.track !== null && row.track !== track) continue;
      const key = row.code;
      // A course listed as mandatory and elective (two tracks, two headings) keeps its first, strongest listing.
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ...row, studyYear: y + yearOffset, source });
    }
  }
  return out;
}

/** The first period with credits in a round, ignoring P0 (the summer before P1). */
export function roundStart(credits: PeriodCredits): Period | null {
  for (let p = 1; p <= 5; p++) if (credits[p] > 0) return p as Period;
  return null;
}

/** Lays a round's credits out from `slot`, shifting the round's shape when it starts elsewhere. */
export function segmentsFor(
  credits: PeriodCredits | null,
  slot: Slot,
  courseCredits: number,
): Segment[] {
  if (!credits) return [{ slot, credits: courseCredits }];
  const start = roundStart(credits);
  if (!start) return [{ slot, credits: courseCredits }];
  const segments: Segment[] = [];
  let cur = slot;
  let last = start;
  for (let p = start; p <= 5; p++) {
    if (!(credits[p] > 0)) continue;
    for (let s = 0; s < p - last; s++) cur = nextSlot(cur, p === 5);
    last = p;
    segments.push({ slot: cur, credits: credits[p] });
  }
  const printed = segments.reduce((a, s) => a + s.credits, 0);
  if (courseCredits - printed > 0.05)
    segments.push({
      slot: nextSlot(cur),
      credits: round1(courseCredits - printed),
      continued: true,
    });
  return segments;
}

/** 15 hp a period is full time, so pace is credits over 15 hp per period spanned. */
export function paceOf(segments: Segment[]): number | null {
  const total = segments.reduce((a, s) => a + s.credits, 0);
  if (!segments.length || total <= 0) return null;
  return Math.round((total / (15 * segments.length)) * 100);
}

interface SourcedRound {
  credits: PeriodCredits;
  source: Exclude<PlanItem["roundSource"], "none">;
}

interface RoundChoice {
  /** Programme rounds first, then the master's, then the catalogue's. */
  rounds: SourcedRound[];
}

/**
 * Every round the course has: the programme's own first, as they are this
 * student's schedule; then this year's rounds from the course's
 * kth.se page; then the catalogue's 2025/26 rounds. All stay in the list, because
 * a course can run twice a year — DH2642 is P2 at 50 % for CINTE and P3–P4 at
 * 25 % in the catalogue — and a placement in P3 should take the P3 round's
 * shape, not the programme's P2 round squeezed into P3.
 */
function roundsFor(
  code: string,
  inputs: PlanInputs,
  prefer: "programme" | "master" | null,
): RoundChoice {
  const own = (d: ProgrammeDetail | null) => d?.rounds[code] ?? [];
  const order: ["programme" | "master", ProgrammeDetail | null][] =
    prefer === "master"
      ? [
          ["master", inputs.master],
          ["programme", inputs.programme],
        ]
      : [
          ["programme", inputs.programme],
          ["master", inputs.master],
        ];
  const rounds: SourcedRound[] = [];
  for (const [source, d] of order)
    for (const credits of own(d)) rounds.push({ credits, source });
  for (const r of inputs.currentRounds[code] ?? [])
    rounds.push({ credits: r.credits, source: "kth" });
  for (const r of inputs.facts.courses[code]?.rounds ?? [])
    rounds.push({ credits: r.credits, source: "catalogue" });
  return { rounds };
}

function defaultSlot(
  row: TemplateCourse,
  startAy: number,
  choice: RoundChoice,
): Slot {
  const ay = startAy + row.studyYear - 1;
  const start =
    choice.rounds
      .map((r) => roundStart(r.credits))
      .find((p): p is Period => p !== null && p !== 5) ?? 1;
  return { ay, p: start };
}

export function buildPlan(inputs: PlanInputs): BuiltPlan {
  const { setup, programme, master, taken, facts, state, now } = inputs;
  const isCiving = programme?.summary.type === "CING";
  const years = yearsOf(programme, isCiving);
  const startAy = setup.intake ? intakeStart(setup.intake).ay : null;
  const nowIdx = slotIndex(now);

  const ownYears = isCiving
    ? [1, 2, 3]
    : Array.from({ length: years }, (_, i) => i + 1);
  const programmeRows = templateRows(
    programme,
    setup.intake,
    setup.track,
    ownYears,
    "programme",
    0,
  );
  const masterRows =
    isCiving && master && setup.intake
      ? templateRows(
          master,
          masterIntakeFor(setup.intake),
          setup.masterTrack,
          [1, 2],
          "master",
          3,
        )
      : [];
  const allRows = [
    ...programmeRows,
    ...masterRows.filter((r) => !programmeRows.some((p) => p.code === r.code)),
  ];
  const template = new Map(allRows.map((r) => [r.code, r]));

  const overlaps = [
    ...(intakeOf(programme, setup.intake)?.overlaps ?? []),
    ...(isCiving && setup.intake
      ? (intakeOf(master, masterIntakeFor(setup.intake))?.overlaps ?? [])
      : []),
  ];
  // Taken means attended. Only a course passed in full counts as done: a U, an F or
  // credits short of the course's own leave it to be taken again.
  const passed = taken.filter((t) =>
    isPassed(
      t,
      template.get(t.courseCode)?.credits ??
        facts.courses[t.courseCode]?.credits ??
        null,
    ),
  );
  const takenBy = new Map(passed.map((t) => [t.courseCode, t]));
  const leftOut = new Set(state.leftOut);
  const chosen = (code: string) =>
    takenBy.has(code) || code in state.placements;

  // "Endast en av": one mandatory member of an overlap set goes in — the one taken or placed, else the first listed.
  const mandatory: TemplateCourse[] = [];
  const alternatives = new Set<string>();
  for (const row of allRows) {
    if (row.category !== "O") continue;
    const set = overlaps.find((s) => s.includes(row.code));
    if (set) {
      const members = allRows.filter(
        (r) => r.category === "O" && set.includes(r.code),
      );
      const pick = members.find((m) => chosen(m.code)) ?? members[0];
      if (pick.code !== row.code) {
        alternatives.add(row.code);
        continue;
      }
    }
    mandatory.push(row);
  }

  const items: PlanItem[] = [];
  const unplaced: PlanItem[] = [];
  const leftOutItems: PlanItem[] = [];

  const make = (
    code: string,
    row: TemplateCourse | null,
    slot: Slot | null,
    placedByStudent: boolean,
  ): PlanItem => {
    const f: CoursePlanFacts | undefined = facts.courses[code];
    const credits = row?.credits ?? f?.credits ?? 0;
    const choice = roundsFor(code, inputs, row?.source ?? null);
    const offeredStarts = [
      ...new Set(
        choice.rounds
          .map((r) => roundStart(r.credits))
          .filter((p): p is Period => p !== null),
      ),
    ].sort();
    // The round that starts in the placed period; failing that, the first round's shape, flagged as off-period.
    const round = slot
      ? (choice.rounds.find((r) => roundStart(r.credits) === slot.p) ??
        choice.rounds[0] ??
        null)
      : null;
    const segments = slot
      ? segmentsFor(round?.credits ?? null, slot, credits)
      : [];
    const t = takenBy.get(code) ?? null;
    const startIdx = segments.length
      ? slotIndex(segments[0].slot)
      : Number.POSITIVE_INFINITY;
    const endIdx = segments.length
      ? slotIndex(segments[segments.length - 1].slot)
      : Number.POSITIVE_INFINITY;
    const status: ItemStatus = t
      ? "passed"
      : !slot
        ? "unplaced"
        : endIdx < nowIdx && inputs.knowsTranscript
          ? "not-passed"
          : startIdx <= nowIdx && endIdx >= nowIdx
            ? "in-progress"
            : "planned";
    return {
      code,
      title: f?.titleEng || row?.name || code,
      credits: t?.earnedCredits ?? credits,
      level: row?.level ?? f?.level ?? "B",
      source: row?.source ?? "own",
      category: row?.category ?? null,
      mandatory: row?.category === "O" && !alternatives.has(code),
      syllabusYear: row?.studyYear ?? null,
      taken: t,
      slot,
      placedByStudent,
      segments,
      pace: paceOf(segments),
      roundSource: round?.source ?? choice.rounds[0]?.source ?? "none",
      offeredStarts,
      offPeriod:
        !!slot &&
        slot.p !== 5 &&
        offeredStarts.length > 0 &&
        !offeredStarts.includes(slot.p),
      status,
      counts: !leftOut.has(code) && status !== "not-passed",
      startIdx,
      endIdx,
    };
  };

  const done = new Set<string>();
  const add = (item: PlanItem) => {
    done.add(item.code);
    if (leftOut.has(item.code)) leftOutItems.push(item);
    else if (item.slot) items.push(item);
    else unplaced.push(item);
  };

  if (startAy !== null)
    for (const row of mandatory) {
      const moved = state.placements[row.code];
      add(
        make(
          row.code,
          row,
          moved ??
            defaultSlot(row, startAy, roundsFor(row.code, inputs, row.source)),
          !!moved,
        ),
      );
    }
  for (const [code, slot] of Object.entries(state.placements)) {
    if (done.has(code)) continue;
    add(make(code, template.get(code) ?? null, slot, true));
  }
  for (const t of passed) {
    if (done.has(t.courseCode)) continue;
    add(make(t.courseCode, template.get(t.courseCode) ?? null, null, false));
  }
  // A mandatory course left out still needs an item, so the tray can offer it back.
  for (const code of leftOut)
    if (!done.has(code) && template.has(code))
      add(make(code, template.get(code) ?? null, null, false));

  const inPlan = new Set(
    [...items, ...unplaced, ...leftOutItems].map((i) => i.code),
  );
  const electives = allRows.filter(
    (r) =>
      !inPlan.has(r.code) && (r.category !== "O" || alternatives.has(r.code)),
  );

  items.sort(
    (a, b) =>
      a.startIdx - b.startIdx ||
      b.credits - a.credits ||
      a.code.localeCompare(b.code),
  );
  return {
    startAy,
    years,
    masterYears: isCiving ? [4, 5] : [],
    items,
    unplaced,
    leftOut: leftOutItems,
    electives,
    template,
    mandatory,
    overlaps,
    passedCodes: passed.map((t) => t.courseCode),
  };
}
