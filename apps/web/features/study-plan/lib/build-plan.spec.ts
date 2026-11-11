import { describe, expect, it } from "vitest";
import type {
  PlanFactsResult,
  PlanRow,
  ProgrammeDetail,
} from "@/types/programme";
import { buildPlan, type PlanInputs, paceOf, segmentsFor } from "./build-plan";
import { checkPlan } from "./check-plan";
import type { PlanState } from "./plan-storage";
import type { Period, Slot } from "./slots";

const at = (ay: number, p: Period): Slot => ({ ay, p });

const row = (
  code: string,
  category: PlanRow["category"],
  credits = 7.5,
  level: PlanRow["level"] = "B",
  note = "",
): PlanRow => ({
  code,
  name: code,
  credits,
  level,
  category,
  track: null,
  note,
});

const programme: ProgrammeDetail = {
  summary: {
    code: "CINTE",
    type: "CING",
    name: "Informationsteknik",
    nameEn: "ICT",
    credits: 300,
    years: 5,
    intakes: ["20242"],
    lastAdmissionTerm: null,
    firstAdmissionTerm: "20072",
    replacedBy: [],
  },
  intakes: {
    "20242": {
      term: "20242",
      years: {
        "1": [row("ID1018", "O"), row("ID1021", "O")],
        "3": [
          row("IV1013", "O", 7.5, "B", "Endast en av IV1013, IK2206"),
          row("IK2206", "O", 7.5, "A"),
          row("DH2642", "VV", 7.5, "A"),
        ],
      },
      borrowedYears: {},
      mastersMapped: ["TCSCM"],
      mastersIndividual: [],
      mastersOpen: [],
      overlaps: [["IK2206", "IV1013"]],
      text: { conditions: "", degreeProject: "", eligibility: "" },
    },
  },
  rounds: {
    ID1018: [[0, 0, 7.5, 0, 0, 0]],
    ID1021: [[0, 0, 0, 7.5, 0, 0]],
    DH2642: [[0, 0, 7.5, 0, 0, 0]],
    IV1013: [[0, 0, 0, 0, 7.5, 0]],
  },
  roundsYear: 2026,
};

const facts: PlanFactsResult = {
  courses: {
    DH2642: {
      code: "DH2642",
      titleSwe: "Interaktionsprogrammering",
      titleEng: "Interaction Programming",
      credits: 7.5,
      level: "A",
      department: "EECS",
      rounds: [
        {
          startTerm: 20261,
          credits: [0, 0, 0, 4.5, 3, 0],
          pace: 25,
          isOpen: false,
        },
      ],
      prerequisites: [
        {
          codes: ["DD1337", "ID1018"],
          strength: "completed",
          open: false,
          unresolvable: false,
          text: "Slutförd kurs motsvarande DD1337 eller ID1018.",
        },
      ],
      registeredCounts: false,
      eligibility: "",
    },
  },
  refs: {},
};

const empty: PlanState = {
  setup: null,
  placements: {},
  leftOut: [],
  dismissed: {},
};
const inputs = (over: Partial<PlanInputs> = {}): PlanInputs => ({
  setup: {
    programme: "CINTE",
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
  state: empty,
  now: { ay: 2026, p: 2 },
  knowsTranscript: true,
  currentRounds: {},
  ...over,
});

describe("segmentsFor and paceOf", () => {
  it("draws 7.5 hp in one period at 50 % and across two at 25 %", () => {
    const p2 = segmentsFor([0, 0, 7.5, 0, 0, 0], { ay: 2027, p: 2 }, 7.5);
    const p3 = segmentsFor([0, 0, 0, 4.5, 3, 0], { ay: 2027, p: 3 }, 7.5);
    expect(p2.map((s) => s.slot.p)).toEqual([2]);
    expect(paceOf(p2)).toBe(50);
    expect(p3.map((s) => s.slot.p)).toEqual([3, 4]);
    expect(paceOf(p3)).toBe(25);
  });

  it("draws credits a round doesn't print as continuing", () => {
    const s = segmentsFor([0, 0, 0, 4.5, 0, 0], { ay: 2027, p: 3 }, 7.5);
    expect(s.at(-1)).toMatchObject({ credits: 3, continued: true });
  });
});

describe("buildPlan", () => {
  it("places mandatory courses in their syllabus period and year", () => {
    const plan = buildPlan(inputs());
    const id1021 = plan.items.find((i) => i.code === "ID1021");
    expect(id1021?.slot).toEqual({ ay: 2024, p: 3 });
    expect(id1021?.mandatory).toBe(true);
  });

  it("places one member of an 'only one of' set, and offers the other as an alternative", () => {
    const plan = buildPlan(inputs());
    expect(plan.items.some((i) => i.code === "IV1013")).toBe(true);
    expect(plan.electives.map((e) => e.code)).toContain("IK2206");
    // Placing the other one makes it the member that counts.
    const swapped = buildPlan(
      inputs({
        state: { ...empty, placements: { IK2206: at(2027, 4) } },
      }),
    );
    expect(swapped.items.some((i) => i.code === "IV1013")).toBe(false);
  });

  it("marks a mandatory course in a period that has ended as not passed, unless it is taken", () => {
    const plain = buildPlan(inputs());
    expect(plain.items.find((i) => i.code === "ID1018")?.status).toBe(
      "not-passed",
    );
    const withTaken = buildPlan(
      inputs({
        taken: [
          {
            courseCode: "ID1018",
            grade: "B",
            earnedCredits: 7.5,
            attendanceYear: 2024,
          },
        ],
      }),
    );
    expect(withTaken.items.find((i) => i.code === "ID1018")?.status).toBe(
      "passed",
    );
  });

  it("doesn't call a visitor's past courses not passed", () => {
    const plan = buildPlan(inputs({ knowsTranscript: false }));
    expect(plan.items.find((i) => i.code === "ID1018")?.status).toBe("planned");
  });

  it("asks the student to place a taken elective, since the transcript has no period", () => {
    const plan = buildPlan(
      inputs({
        taken: [
          {
            courseCode: "DD1337",
            grade: "A",
            earnedCredits: 7,
            attendanceYear: 2025,
          },
        ],
      }),
    );
    expect(plan.unplaced.map((i) => i.code)).toEqual(["DD1337"]);
  });

  it("takes a round this year's course page lists: IA150X alone in P4 is 100 %", () => {
    const placed = buildPlan(
      inputs({
        state: { ...empty, placements: { DH2642: at(2027, 4) } },
        currentRounds: {
          DH2642: [
            {
              term: "20271",
              credits: [0, 0, 0, 0, 7.5, 0],
              pace: 100,
              programmes: [],
            },
          ],
        },
      }),
    ).items.find((i) => i.code === "DH2642");
    expect([placed?.pace, placed?.roundSource, placed?.offPeriod]).toEqual([
      50,
      "kth",
      false,
    ]);
  });

  it("uses the round that starts in the placed period: DH2642 in P2 is the programme's, in P3 the catalogue's", () => {
    const p2 = buildPlan(
      inputs({
        state: { ...empty, placements: { DH2642: at(2027, 2) } },
      }),
    ).items.find((i) => i.code === "DH2642");
    const p3 = buildPlan(
      inputs({
        state: { ...empty, placements: { DH2642: at(2027, 3) } },
      }),
    ).items.find((i) => i.code === "DH2642");
    expect([p2?.pace, p2?.roundSource]).toEqual([50, "programme"]);
    expect([p3?.pace, p3?.roundSource, p3?.offPeriod]).toEqual([
      25,
      "catalogue",
      false,
    ]);
  });
});

describe("checkPlan", () => {
  it("warns when a planned course sits in a period it isn't given in, with a move to each one it is", () => {
    const plan = buildPlan(
      inputs({
        state: { ...empty, placements: { DH2642: at(2027, 1) } },
      }),
    );
    const c = checkPlan(plan, facts, empty, { ay: 2026, p: 2 }, []).find(
      (x) => x.rule === "offered",
    );
    expect(c?.code).toBe("DH2642");
    expect(c?.fixes.map((f) => f.label)).toEqual(["Move to P2", "Move to P3"]);
  });

  it("warns about a prerequisite nothing earlier covers, and not once it is taken", () => {
    const state = { ...empty, placements: { DH2642: at(2027, 2) } };
    const plan = buildPlan(inputs({ state, knowsTranscript: false }));
    const before = checkPlan(plan, facts, state, { ay: 2026, p: 2 }, []).filter(
      (x) => x.rule === "prerequisite",
    );
    // ID1018 is mandatory in year 1, so it is earlier in the plan: no warning.
    expect(before).toEqual([]);
    const without = buildPlan(
      inputs({
        state: { ...state, leftOut: ["ID1018"] },
        knowsTranscript: false,
      }),
    );
    const missing = checkPlan(
      without,
      facts,
      { ...state, leftOut: ["ID1018"] },
      { ay: 2026, p: 2 },
      [],
    ).filter((x) => x.rule === "prerequisite");
    expect(missing.map((x) => x.code)).toEqual(["DH2642"]);
    expect(
      checkPlan(without, facts, state, { ay: 2026, p: 2 }, ["DD1337"]).filter(
        (x) => x.rule === "prerequisite",
      ),
    ).toEqual([]);
  });

  it("takes basic-level prerequisites as met when the plan starts from a degree", () => {
    const state = {
      ...empty,
      placements: { DH2642: at(2027, 2) },
      leftOut: ["ID1018"],
    };
    const plan = buildPlan(inputs({ state, knowsTranscript: false }));
    const rule = (entry: boolean) =>
      checkPlan(plan, facts, state, { ay: 2026, p: 2 }, [], entry).filter(
        (x) => x.rule === "prerequisite",
      );
    expect(rule(false)).toHaveLength(1);
    expect(rule(true)).toEqual([]);
  });
});
