import { describe, expect, it } from "vitest";
import type {
  CoursePlanFacts,
  PlanFactsResult,
  PlanRow,
  PrerequisiteGroup,
  ProgrammeDetail,
} from "@/types/programme";
import { buildPlan, type PlanInputs } from "./build-plan";
import { checkPlan, firstPeriodBefore, sameSubject } from "./check-plan";
import type { PlanState } from "./plan-storage";
import type { Period } from "./slots";

const row = (code: string): PlanRow => ({
  code,
  name: code,
  credits: 7.5,
  level: code[2] === "2" ? "A" : "B",
  category: "O",
  track: null,
  note: "",
});
const group = (codes: string[], text: string): PrerequisiteGroup => ({
  codes,
  strength: "completed",
  open: false,
  unresolvable: false,
  text,
});
const course = (
  code: string,
  prerequisites: PrerequisiteGroup[],
): CoursePlanFacts => ({
  code,
  titleSwe: code,
  titleEng: code,
  credits: 7.5,
  level: "A",
  department: "SCI",
  rounds: [],
  prerequisites,
  registeredCounts: false,
  eligibility: "",
});

// A finance track in miniature: year 1 gives numerical methods under its own
// code; year 2 runs probability theory, year 3 derivatives, then regression.
const programme: ProgrammeDetail = {
  summary: {
    code: "CXXXX",
    type: "CING",
    name: "X",
    nameEn: "X",
    credits: 300,
    years: 5,
    intakes: ["20242"],
    lastAdmissionTerm: null,
    firstAdmissionTerm: null,
    replacedBy: [],
  },
  intakes: {
    "20242": {
      term: "20242",
      years: {
        "1": [row("SF1546"), row("SF1625")],
        "2": [row("SF2940")],
        "3": [row("SF2975"), row("SF2930"), row("SF2955")],
      },
      borrowedYears: {},
      mastersMapped: [],
      mastersIndividual: [],
      mastersOpen: [],
      overlaps: [],
      text: { conditions: "", degreeProject: "", eligibility: "" },
    },
  },
  rounds: {
    SF1546: [[0, 7.5, 0, 0, 0, 0]],
    SF1625: [[0, 0, 7.5, 0, 0, 0]],
    SF2940: [[0, 7.5, 0, 0, 0, 0]],
    SF2975: [[0, 0, 7.5, 0, 0, 0]],
    SF2930: [[0, 0, 0, 7.5, 0, 0]],
    SF2955: [[0, 0, 0, 0, 7.5, 0]],
  },
  roundsYear: 2026,
};

const facts: PlanFactsResult = {
  courses: {
    SF2940: course("SF2940", [
      group(
        ["SF1918", "SF1922"],
        "Slutförd grundkurs i sannolikhetsteori och statistik (SF1918, SF1922 eller motsvarande).",
      ),
    ]),
    SF2975: course("SF2975", [
      group(
        ["SF2940"],
        "Slutförd kurs i sannolikhetsteori (SF2940 eller motsvarande).",
      ),
    ]),
    SF2930: course("SF2930", [
      group(
        ["SF1544", "SF1545"],
        "Slutförd grundkurs i numerisk analys (SF1544, SF1545 eller motsvarande).",
      ),
    ]),
    // Asks for the same probability course SF2940 does.
    SF2955: course("SF2955", [
      group(
        ["SF1918", "SF1922"],
        "Slutförd grundkurs i matematisk statistik (SF1918, SF1922 eller motsvarande kurs).",
      ),
    ]),
  },
  refs: Object.fromEntries(
    [
      ["SF1544", "Numeriska metoder, grundkurs I"],
      ["SF1545", "Numeriska metoder, grundkurs II"],
      ["SF1546", "Numeriska metoder, grundkurs"],
      ["SF1625", "Envariabelanalys"],
      ["SF1918", "Sannolikhetsteori och statistik"],
      ["SF1922", "Sannolikhetsteori och statistik"],
    ].map(([code, titleSwe]) => [code, { code, titleSwe, level: "B" }]),
  ) as unknown as PlanFactsResult["refs"],
};

const empty: PlanState = {
  setup: null,
  placements: {},
  leftOut: [],
  dismissed: {},
};
const start = { ay: 2024, p: 1 as Period };
function checksFor(state: PlanState = empty, now = start) {
  const inputs: PlanInputs = {
    setup: {
      programme: "CXXXX",
      intake: "20242",
      master: null,
      track: null,
      masterTrack: null,
      summer: false,
    },
    programme,
    master: null,
    taken: [],
    facts,
    state,
    now,
    knowsTranscript: false,
    currentRounds: {},
  };
  // SF1922 is given in P3; nothing else outside the programme is.
  const starts = (code: string): Period[] => (code === "SF1922" ? [3] : []);
  return checkPlan(
    buildPlan(inputs),
    facts,
    state,
    now,
    [],
    false,
    starts,
  ).filter((c) => c.rule === "prerequisite");
}

describe("prerequisite checks", () => {
  it("lets a same-subject course stand in where the syllabus says 'eller motsvarande', as a note", () => {
    const sf2930 = checksFor().filter((c) => c.code === "SF2930");
    expect(sf2930).toHaveLength(1);
    expect(sf2930[0].severity).toBe("note");
    expect(sf2930[0].message).toContain("SF1546 should count as equivalent");
  });

  it("offers the missing course in the first period it's given before the course that needs it", () => {
    const sf2940 = checksFor().find((c) => c.code === "SF2940");
    expect(sf2940?.severity).toBe("warning");
    expect(sf2940?.fixes).toEqual([
      {
        kind: "place",
        code: "SF1922",
        slot: { ay: 2024, p: 3 },
        label: "Add SF1922 to VT 2025 P3",
      },
    ]);
  });

  it("blocks the chain: a course after a blocked one is blocked too, and says why", () => {
    const sf2975 = checksFor().find((c) => c.code === "SF2975");
    expect(sf2975?.severity).toBe("warning");
    expect(sf2975?.message).toBe(
      "SF2975 needs SF2940 first, but SF2940 can't be taken as planned either: its own prerequisites aren't met.",
    );
  });

  it("clears the whole chain once the missing course is in the plan", () => {
    const fixed = checksFor({
      ...empty,
      placements: { SF1922: { ay: 2024, p: 3 } },
    });
    expect(fixed.filter((c) => c.severity === "warning")).toEqual([]);
  });
});

describe("sameSubject", () => {
  it("treats numbered parts of one basic course as one subject, and different subjects as different", () => {
    expect(
      sameSubject(
        "Numeriska metoder, grundkurs I",
        "Numeriska metoder, grundkurs",
      ),
    ).toBe(true);
    expect(sameSubject("Envariabelanalys", "Flervariabelanalys")).toBe(false);
    expect(
      sameSubject(
        "Sannolikhetsteori och statistik",
        "Sannolikhetslära och statistik",
      ),
    ).toBe(true);
  });

  it("doesn't let a one-word subject cover a broader course", () => {
    // COPEN's DD1310 is not basic computer science (DD1320–DD1328, DD1338).
    expect(
      sameSubject(
        "Programmeringsteknik",
        "Tillämpad programmering och datalogi",
      ),
    ).toBe(false);
    expect(sameSubject("Programmeringsteknik", "Programmering")).toBe(true);
  });
});

describe("firstPeriodBefore", () => {
  it("finds the first future period the course is given in, before the deadline", () => {
    expect(firstPeriodBefore([3], { ay: 2024, p: 3 }, 20271)).toEqual({
      ay: 2025,
      p: 3,
    });
    expect(firstPeriodBefore([3], { ay: 2024, p: 1 }, 20243)).toBeNull();
  });
});

describe("prerequisites once a course has started", () => {
  // Autumn 2025: SF2940 (P1) has started; everything in year 3 is still to come.
  const later = { ay: 2025, p: 2 as Period };

  it("doesn't check a course that has already started: its eligibility was settled then", () => {
    expect(
      checksFor(empty, later).find((c) => c.code === "SF2940"),
    ).toBeUndefined();
  });

  it("counts a later course's prerequisite as met when a course already taken asked for the same", () => {
    const checks = checksFor(empty, later);
    expect(checks.filter((c) => c.severity === "warning")).toEqual([]);
    const sf2955 = checks.find((c) => c.code === "SF2955");
    expect(sf2955?.severity).toBe("note");
    expect(sf2955?.message).toBe(
      "SF2955 asks for SF1918, SF1922. SF2940, which you've taken, asked for the same, so it counts as met.",
    );
  });
});
