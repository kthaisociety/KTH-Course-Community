import { describe, expect, it } from "vitest";
import type { PlanRow, ProgrammeDetail } from "@/types/programme";
import { buildPlan } from "./build-plan";
import { isOpenEntrance, withContinuation } from "./open-entrance";

const row = (code: string, credits: number): PlanRow => ({
  code,
  name: code,
  credits,
  level: "B",
  category: "O",
  track: null,
  note: "",
});

function detail(
  code: string,
  years: Record<string, PlanRow[]>,
  mastersMapped: string[] = [],
): ProgrammeDetail {
  return {
    summary: {
      code,
      type: "CING",
      name: code,
      nameEn: code,
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
        years,
        borrowedYears: {},
        mastersMapped,
        mastersIndividual: [],
        mastersOpen: [],
        overlaps: [],
        text: { conditions: "", degreeProject: "", eligibility: "" },
      },
    },
    rounds: Object.fromEntries(
      Object.values(years)
        .flat()
        .map((r) => [r.code, [[0, r.credits ?? 0, 0, 0, 0, 0]]]),
    ),
    roundsYear: 2026,
  };
}

const open = detail("COPEN", { "1": [row("OO1001", 60)] });
const next = detail(
  "CDATE",
  {
    "1": [row("DD1001", 60)],
    "2": [row("DD2001", 60)],
    "3": [row("DD3001", 60)],
  },
  ["TCSCM"],
);

describe("open entrance", () => {
  it("is told apart by a civilingenjör syllabus that stops after year 1", () => {
    expect(isOpenEntrance(open, "20242")).toBe(true);
    expect(isOpenEntrance(next, "20242")).toBe(false);
  });

  it("takes year 1 from the open entrance and years 2 onward from the chosen programme", () => {
    const merged = withContinuation(open, next, "20242");
    const years = merged.intakes["20242"].years;
    expect(years["1"].map((r) => r.code)).toEqual(["OO1001"]);
    expect(years["2"].map((r) => r.code)).toEqual(["DD2001"]);
    expect(years["3"].map((r) => r.code)).toEqual(["DD3001"]);
    // The degree, and the master's it maps, are the chosen programme's.
    expect(merged.summary.code).toBe("CDATE");
    expect(merged.intakes["20242"].mastersMapped).toEqual(["TCSCM"]);
  });

  it("gives the plan courses in year 2, which an open entrance alone leaves empty", () => {
    const inputs = {
      setup: {
        programme: "COPEN",
        intake: "20242",
        master: null,
        track: null,
        masterTrack: null,
        summer: false,
        continuation: "CDATE",
      },
      master: null,
      taken: [],
      facts: { courses: {}, refs: {} },
      state: { setup: null, placements: {}, leftOut: [], dismissed: {} },
      now: { ay: 2024, p: 1 as const },
      knowsTranscript: false,
      currentRounds: {},
    };
    const alone = buildPlan({ ...inputs, programme: open });
    expect(alone.items.map((i) => i.code)).toEqual(["OO1001"]);

    const plan = buildPlan({
      ...inputs,
      programme: withContinuation(open, next, "20242"),
    });
    expect(plan.items.map((i) => [i.code, i.slot?.ay])).toEqual([
      ["OO1001", 2024],
      ["DD2001", 2025],
      ["DD3001", 2026],
    ]);
  });
});
