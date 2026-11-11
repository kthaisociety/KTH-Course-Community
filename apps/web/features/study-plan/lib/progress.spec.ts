import { describe, expect, it } from "vitest";
import type {
  DegreeProjectGate,
  PlanFactsResult,
  PlanRow,
  ProgrammeDetail,
  ProgrammeType,
} from "@/types/programme";
import { buildPlan, isPassed, type PlanInputs } from "./build-plan";
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
const civing = programme(
  "CXXXX",
  "CING",
  300,
  {
    "1": [row("AA1001", 30), row("AA1002", 30)],
    "2": [row("AA2001", 30), row("AA2002", 30)],
    "3": [row("AA3001", 30), row("AA300X", 15)],
  },
  {
    AA1001: [[0, 30, 0, 0, 0, 0]],
    AA1002: [[0, 0, 0, 30, 0, 0]],
    AA2001: [[0, 30, 0, 0, 0, 0]],
    AA2002: [[0, 0, 0, 30, 0, 0]],
    AA3001: [[0, 30, 0, 0, 0, 0]],
    AA300X: [[0, 0, 0, 15, 0, 0]],
  },
);
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
    facts: noFacts,
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
    expect(line(sections, "bachelor", "Mandatory courses")?.text).toMatch(
      /^Mandatory courses: 0 of/,
    );
  });
});

describe("computeProgress", () => {
  it("groups the 110 hp from years 1–2 by the syllabus's year, not where a course was moved", () => {
    // AA2002 belongs to year 2; moving it into year 3 P1 (still before the master's) keeps it in years 1–2.
    const sections = progressOf({
      state: { ...empty, placements: { AA2002: at(2026, 1) } },
    });
    expect(
      line(sections, "bachelor", "Of those, from years 1–2")?.text,
    ).toMatch(/^Of those, from years 1–2: 120 of 110/);
  });

  it("checks a master's degree project's total bar as well as its advanced one", () => {
    const sections = progressOf({
      projects: {
        BB200X: gate("BB200X", { credits: 60 * 4, advancedCredits: 30 }),
      },
    });
    expect(
      line(sections, "master", "Credits before BB200X starts")?.state,
    ).toBe("short");
    expect(
      line(sections, "master", "Advanced credits before BB200X starts")?.state,
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
      line(progressOf({ programme: architect }), "bachelor", "Credits")?.text,
    ).toMatch(/of 300 hp/);
    expect(line(progressOf({}), "bachelor", "Credits")?.text).toMatch(
      /of 180 hp/,
    );
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
