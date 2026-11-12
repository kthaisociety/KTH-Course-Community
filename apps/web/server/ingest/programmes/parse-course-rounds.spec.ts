import { describe, expect, it } from "vitest";
import { parseCourseRounds } from "./parse-course-rounds";

/** A course page's embedded data, the way kth.se ships it: URL-encoded JSON. */
const page = (roundsBySemester: unknown) =>
  `<script>window.__compressedData__DATA = "${encodeURIComponent(JSON.stringify({ courseData: { roundsBySemester } }))}"</script>`;

// IA150X's rounds for 2026/27: P1, P2 and P4 alone at 100 %, and CINTE's P3–P4 at 50 %.
const IA150X = page({
  "20262": [
    {
      round_periods: '<p class="periode-list">HT 2026: P1 (15 hp)</p>',
      round_study_pace: 100,
      round_part_of_programme: "",
    },
    {
      round_periods: '<p class="periode-list">HT 2026: P2 (15 hp)</p>',
      round_study_pace: 100,
      round_part_of_programme: "",
    },
  ],
  "20271": [
    {
      round_periods: '<p class="periode-list">VT 2027: P4 (15 hp)</p>',
      round_study_pace: 100,
      round_part_of_programme: "",
    },
    {
      round_periods:
        '<p class="periode-list">VT 2027: P4 (7.5 hp), P3 (7.5 hp)</p>',
      round_study_pace: 50,
      round_part_of_programme:
        '<a href="/student/kurser/program/CINTE/20242/arskurs3">CINTE</a>',
    },
    {
      round_periods: '<p class="periode-list">VT 2027: P3 (15 hp)</p>',
      round_study_pace: 100,
      round_is_cancelled: true,
    },
  ],
});

describe("parseCourseRounds", () => {
  const rounds = parseCourseRounds(IA150X);

  it("reads every round with its credits per period and pace", () => {
    expect(rounds.map((r) => [r.term, r.credits, r.pace])).toEqual([
      ["20262", [0, 15, 0, 0, 0, 0], 100],
      ["20262", [0, 0, 15, 0, 0, 0], 100],
      ["20271", [0, 0, 0, 0, 15, 0], 100],
      ["20271", [0, 0, 0, 7.5, 7.5, 0], 50],
    ]);
  });

  it("keeps the programmes a round is part of, and drops cancelled rounds", () => {
    expect(rounds[3].programmes).toEqual(["CINTE"]);
    expect(rounds).toHaveLength(4);
  });

  it("reads nothing from a page without the data", () => {
    expect(parseCourseRounds("<html></html>")).toEqual([]);
  });
});
