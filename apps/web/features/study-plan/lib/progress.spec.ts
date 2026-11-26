import { describe, expect, it } from "vitest";
import type {
  DegreeProjectGate,
  PlanFactsResult,
  PlanRow,
  ProgrammeDetail,
  ProgrammeType,
} from "@/types/programme";
import {
  buildPlan,
  codesNeedingFacts,
  isPassed,
  type PlanInputs,
} from "./build-plan";
import { IMPORTABLE_KEY, type PlanState } from "./plan-storage";
import { computeProgress } from "./progress";
import type { Period, Slot } from "./slots";

const at = (ay: number, p: Period): Slot => ({ ay, p });
const row = (
  code: string,
  credits: number,
  level: PlanRow["level"] = "B",
): PlanRow => ({
  code,
  name: code,
  credits,
  level,
  category: "O",
  track: null,
  note: "",
});

function programme(
  code: string,
  type: ProgrammeType,
  credits: number,
  years: Record<string, PlanRow[]>,
  rounds: Record<string, number[][]> = {},
): ProgrammeDetail {
  return {
    summary: {
      code,
      type,
      name: code,
      nameEn: code,
      credits,
      years: Object.keys(years).length || 1,
      intakes: ["20242", "20272"],
      lastAdmissionTerm: null,
      firstAdmissionTerm: null,
      replacedBy: [],
    },
    intakes: {
      "20242": {
        term: "20242",
        years,
        borrowedYears: {},
        mastersMapped: [],
        mastersIndividual: [],
        mastersOpen: [],
        overlaps: [],
        text: { conditions: "", degreeProject: "", eligibility: "" },
      },
      "20272": {
        term: "20272",
        years,
        borrowedYears: {},
        mastersMapped: [],
        mastersIndividual: [],
        mastersOpen: [],
        overlaps: [],
        text: { conditions: "", degreeProject: "", eligibility: "" },
      },
    },
    rounds,
    roundsYear: 2026,
  };
}

// A civilingenjör programme: 60 hp a year in years 1–3, all mandatory, given in P1.
const civingYears: Record<string, PlanRow[]> = {
  "1": [row("AA1001", 30), row("AA1002", 30)],
  "2": [row("AA2001", 30), row("AA2002", 30)],
  "3": [row("AA3001", 30), row("AA300X", 15)],
};
const civingRounds: Record<string, number[][]> = {
  AA1001: [[0, 30, 0, 0, 0, 0]],
  AA1002: [[0, 0, 0, 30, 0, 0]],
  AA2001: [[0, 30, 0, 0, 0, 0]],
  AA2002: [[0, 0, 0, 30, 0, 0]],
  AA3001: [[0, 30, 0, 0, 0, 0]],
  AA300X: [[0, 0, 0, 15, 0, 0]],
};
const civing = programme("CXXXX", "CING", 300, civingYears, civingRounds);
// Its master's: an advanced course and a degree project.
const master = programme(
  "TXXXM",
  "TMAST",
  120,
  { "1": [row("BB2001", 30, "A")], "2": [row("BB200X", 30, "A")] },
  { BB2001: [[0, 30, 0, 0, 0, 0]], BB200X: [[0, 0, 0, 30, 0, 0]] },
);

const empty: PlanState = {
  setup: null,
  placements: {},
  leftOut: [],
  dismissed: {},
};
const noFacts: PlanFactsResult = { courses: {}, refs: {} };
const gate = (
  code: string,
  over: Partial<DegreeProjectGate>,
): DegreeProjectGate => ({
  code,
  credits: null,
  advancedCredits: null,
  masterCredits: null,
  needsBachelorPart: false,
  needsMethods: false,
  courses: [],
  when: null,
  text: "",
  ...over,
});

function progressOf(
  over: Partial<PlanInputs> & {
    projects?: Record<string, DegreeProjectGate>;
    programme?: ProgrammeDetail;
  },
) {
  const inputs: PlanInputs = {
    setup: {
      programme: over.programme?.summary.code ?? "CXXXX",
      intake: "20242",
      master: "TXXXM",
      track: null,
      masterTrack: null,
      summer: false,
    },
    programme: over.programme ?? civing,
    master: over.programme ? null : master,
    taken: [],
    facts: noFacts,
    state: empty,
    now: at(2024, 1),
    knowsTranscript: true,
    currentRounds: {},
    ...over,
  };
  const plan = buildPlan(inputs);
  return computeProgress({
    setup: inputs.setup,
    plan,
    programme: inputs.programme,
    master: inputs.master,
    eligibility: null,
    areas: [],
    projects: over.projects ?? {},
    facts: inputs.facts,
    now: inputs.now,
  });
}
const line = (
  sections: ReturnType<typeof progressOf>,
  id: string,
  starts: string,
) =>
  sections
    .find((s) => s.id === id)
    ?.criteria.find((c) => c.text.startsWith(starts));
/** A meter by its exact label and the line under it, e.g. "Advanced credits" / "Before BB200X starts". */
const meterLine = (
  sections: ReturnType<typeof progressOf>,
  id: string,
  text: string,
  detail: string,
) =>
  sections
    .find((s) => s.id === id)
    ?.criteria.find((c) => c.text === text && c.detail === detail);

describe("isPassed", () => {
  it("counts a failing grade or partial credits as not passed", () => {
    const t = {
      courseCode: "X",
      grade: "B",
      earnedCredits: 7.5,
      attendanceYear: 2025,
    };
    expect(isPassed(t, 7.5)).toBe(true);
    expect(isPassed({ ...t, grade: "U" }, 7.5)).toBe(false);
    expect(isPassed({ ...t, grade: "Fx" }, 7.5)).toBe(false);
    expect(isPassed({ ...t, earnedCredits: 4.5 }, 7.5)).toBe(false);
  });

  it("doesn't let a failed course satisfy a mandatory course", () => {
    const sections = progressOf({
      taken: [
        {
          courseCode: "AA1001",
          grade: "U",
          earnedCredits: 0,
          attendanceYear: 2025,
        },
      ],
    });
    expect(
      line(sections, "bachelor", "Mandatory courses")?.meter,
    ).toMatchObject({ done: 0, unit: "courses" });
  });
});

describe("codesNeedingFacts", () => {
  it("asks for a partly credited course's facts whether or not they have loaded, so the request settles", () => {
    const taken = [
      {
        courseCode: "ZZ1000",
        grade: "P",
        earnedCredits: 3,
        attendanceYear: 2025,
      },
    ];
    const base: PlanInputs = {
      setup: {
        programme: "CXXXX",
        intake: "20242",
        master: null,
        track: null,
        masterTrack: null,
        summer: false,
      },
      programme: civing,
      master: null,
      taken,
      facts: noFacts,
      state: empty,
      now: at(2024, 1),
      knowsTranscript: true,
      currentRounds: {},
    };
    const loaded: PlanFactsResult = {
      courses: {
        ZZ1000: {
          code: "ZZ1000",
          titleSwe: "Z",
          titleEng: "Z",
          credits: 7.5,
          level: "B",
          department: "",
          rounds: [],
          prerequisites: [],
          registeredCounts: false,
          eligibility: "",
        },
      },
      refs: {},
    };
    const before = buildPlan(base);
    const after = buildPlan({ ...base, facts: loaded });
    // Without its credits it counts as passed; with them it doesn't, and leaves the plan.
    expect(before.unplaced.map((i) => i.code)).toEqual(["ZZ1000"]);
    expect(after.unplaced).toEqual([]);
    expect(codesNeedingFacts(before, taken)).toEqual(
      codesNeedingFacts(after, taken),
    );
  });
});

describe("computeProgress", () => {
  it("groups the 110 hp from years 1–2 by the syllabus's year, not where a course was moved", () => {
    // AA2002 belongs to year 2; moving it into year 3 P1 (still before the master's) keeps it in years 1–2.
    const sections = progressOf({
      state: { ...empty, placements: { AA2002: at(2026, 1) } },
    });
    const years12 = line(sections, "bachelor", "Of those, from years 1–2");
    const meter = years12?.meter;
    expect(meter && meter.done + meter.planned).toBe(120);
    expect(meter?.need).toBe(110);
    // The year rows add up to 90 here; the line under the meter says where the other 30 sit.
    expect(years12?.detail).toBe(
      "Incl. AA2002, a year 1–2 course placed in year 3",
    );
  });

  it("doesn't count a course left out of the plan", () => {
    const sections = progressOf({ state: { ...empty, leftOut: ["AA2002"] } });
    const meter = line(sections, "bachelor", "Of those, from years 1–2")?.meter;
    expect(meter && meter.done + meter.planned).toBe(90);
  });

  it("counts only one course of an 'Endast en av' set toward the credits", () => {
    // Two year-2 electives of which only one may count, both placed.
    const withChoice = programme(
      "CXXXX",
      "CING",
      300,
      {
        ...civingYears,
        "2": [
          ...civingYears["2"],
          { ...row("AA2101", 7.5), category: "VV" },
          { ...row("AA2102", 7.5), category: "VV" },
        ],
      },
      civingRounds,
    );
    withChoice.intakes["20242"].overlaps = [["AA2101", "AA2102"]];
    const sections = progressOf({
      programme: withChoice,
      master,
      state: {
        ...empty,
        placements: { AA2101: at(2025, 2), AA2102: at(2025, 3) },
      },
    });
    const meter = line(sections, "bachelor", "Of those, from years 1–2")?.meter;
    expect(meter && meter.done + meter.planned).toBe(127.5);
  });

  it("counts one course of an 'Endast en av' set toward the gate to the master's part too", () => {
    const withChoice = programme(
      "CXXXX",
      "CING",
      300,
      {
        ...civingYears,
        "3": [
          ...civingYears["3"],
          { ...row("AA3101", 7.5), category: "VV" },
          { ...row("AA3102", 7.5), category: "VV" },
        ],
      },
      civingRounds,
    );
    withChoice.intakes["20242"].overlaps = [["AA3101", "AA3102"]];
    const sections = progressOf({
      programme: withChoice,
      master,
      state: {
        ...empty,
        placements: { AA3101: at(2026, 2), AA3102: at(2026, 3) },
      },
    });
    const gate = line(sections, "bachelor", "Gate to the master's part")?.meter;
    expect(gate && gate.done + gate.planned).toBe(172.5);
  });

  it("keeps an earlier course of a set for a deadline a larger, later one misses", () => {
    // AA2101 (7.5 hp) ends before the kandidat project starts; AA2102 (9 hp), its
    // overlap, comes after. Chosen over the whole plan, AA2102 would win and the
    // project's meter would lose both.
    const withChoice = programme(
      "CXXXX",
      "CING",
      300,
      {
        ...civingYears,
        "2": [
          ...civingYears["2"],
          { ...row("AA2101", 7.5), category: "VV" },
          { ...row("AA2102", 9), category: "VV" },
        ],
      },
      civingRounds,
    );
    withChoice.intakes["20242"].overlaps = [["AA2101", "AA2102"]];
    const sections = progressOf({
      programme: withChoice,
      master,
      projects: { AA300X: gate("AA300X", { credits: 200 }) },
      state: {
        ...empty,
        placements: { AA2101: at(2025, 2), AA2102: at(2027, 1) },
      },
    });
    const before = line(sections, "bachelor", "Before AA300X starts")?.meter;
    expect(before && before.done + before.planned).toBe(157.5);
  });

  it("counts a course once when it was taken under another code", () => {
    // AA3001 was taken early as ZZ3001, the same course under its old code.
    const facts: PlanFactsResult = {
      courses: {},
      refs: {
        AA3001: { code: "AA3001", titleSwe: "Signaler", level: "B" },
        ZZ3001: { code: "ZZ3001", titleSwe: "Signaler", level: "B" },
      },
    } as unknown as PlanFactsResult;
    const sections = progressOf({
      facts,
      taken: [
        {
          courseCode: "ZZ3001",
          grade: "A",
          earnedCredits: 30,
          attendanceYear: 2025,
        },
      ],
      state: { ...empty, placements: { ZZ3001: at(2025, 1) } },
    });
    const meter = line(sections, "bachelor", "Credits, years 1–3")?.meter;
    expect(meter && meter.done + meter.planned).toBe(165);
  });

  it("keeps the mandatory courses whole when an overlapping course takes the credits", () => {
    // AA2101 is passed, so it is the one of the pair that counts; AA2001 must still read as planned.
    const withChoice = programme(
      "CXXXX",
      "CING",
      300,
      {
        ...civingYears,
        "2": [...civingYears["2"], { ...row("AA2101", 30), category: "VV" }],
      },
      civingRounds,
    );
    withChoice.intakes["20242"].overlaps = [["AA2001", "AA2101"]];
    const sections = progressOf({
      programme: withChoice,
      master,
      taken: [
        {
          courseCode: "AA2101",
          grade: "A",
          earnedCredits: 30,
          attendanceYear: 2025,
        },
      ],
      state: { ...empty, placements: { AA2101: at(2024, 1) } },
    });
    expect(
      line(sections, "bachelor", "Mandatory courses")?.meter,
    ).toMatchObject({ done: 0, planned: 6, need: 6 });
    const meter = line(sections, "bachelor", "Of those, from years 1–2")?.meter;
    expect(meter).toMatchObject({ done: 30, planned: 90 });
  });

  it("checks a master's degree project's total bar as well as its advanced one", () => {
    const sections = progressOf({
      projects: {
        BB200X: gate("BB200X", { credits: 60 * 4, advancedCredits: 30 }),
      },
    });
    expect(
      meterLine(sections, "master", "Credits", "Before BB200X starts")?.state,
    ).toBe("short");
    expect(
      meterLine(sections, "master", "Advanced credits", "Before BB200X starts")
        ?.state,
    ).toBe("planned");
  });

  it("checks the bachelor courses against the project's start, not just eventually", () => {
    const projects = {
      BB200X: gate("BB200X", { advancedCredits: 30, needsBachelorPart: true }),
    };
    const onTime = progressOf({ projects });
    expect(
      line(onTime, "master", "Every mandatory course of years 1–3")?.state,
    ).toBe("planned");
    // A year-3 course moved after the project starts no longer counts as done first.
    const late = progressOf({
      projects,
      state: { ...empty, placements: { AA3001: at(2028, 4) } },
    });
    expect(
      line(late, "master", "Every mandatory course of years 1–3")?.state,
    ).toBe("short");
  });

  it("uses the programme's own size outside a civilingenjör's bachelor part", () => {
    const architect = programme("ARKXX", "TARKU", 300, {
      "1": [row("CC1001", 60)],
    });
    expect(
      line(progressOf({ programme: architect }), "bachelor", "Credits")?.meter
        ?.need,
    ).toBe(300);
    expect(line(progressOf({}), "bachelor", "Credits")?.meter?.need).toBe(180);
  });
});

describe("IMPORTABLE_KEY", () => {
  it("keeps dismissed checks whose rule names carry hyphens", () => {
    expect(IMPORTABLE_KEY.test("ok:ID1018:not-passed")).toBe(true);
    expect(IMPORTABLE_KEY.test("ok:DH2642:prerequisite")).toBe(true);
    expect(IMPORTABLE_KEY.test("at:DH2642")).toBe(true);
    expect(IMPORTABLE_KEY.test("evil:key")).toBe(false);
  });
});
