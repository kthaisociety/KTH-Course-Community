import { describe, expect, it } from "vitest";
import { EXAMINATION_DISTRIBUTION_KEYS } from "@/types";
import {
  EXAMINATION_COLORS,
  EXAMINATION_INK,
  examinationSegments,
  examinationSplitLabel,
} from "./examination-palette";

describe("the examination palette", () => {
  it("colours all six schema keys, not the design's five", () => {
    for (const key of EXAMINATION_DISTRIBUTION_KEYS) {
      expect(EXAMINATION_COLORS[key]).toMatch(/^#[0-9a-f]{6}$/);
      expect(EXAMINATION_INK[key]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  // Two categories sharing a fill would make a stacked bar lie about which
  // slice is which, which is the whole reason `seminars` needed its own value.
  it("gives no two categories the same fill", () => {
    const fills = Object.values(EXAMINATION_COLORS);
    expect(new Set(fills).size).toBe(fills.length);
  });
});

describe("examinationSegments", () => {
  it("draws nothing at all for a reviewer who did not remember", () => {
    expect(examinationSegments(null)).toEqual([]);
    expect(examinationSplitLabel(null)).toBeNull();
  });

  it("drops the categories the reviewer put at zero", () => {
    const segments = examinationSegments({
      exam: 60,
      assignments: 40,
      labs: 0,
      projects: 0,
      seminars: 0,
      other: 0,
    });
    expect(segments.map((segment) => segment.key)).toEqual([
      "exam",
      "assignments",
    ]);
    expect(
      examinationSplitLabel({
        exam: 60,
        assignments: 40,
        labs: 0,
        projects: 0,
        seminars: 0,
        other: 0,
      }),
    ).toBe("60% / 40%");
  });

  it("names a slice only when it is wide enough to hold the word", () => {
    const segments = examinationSegments({
      exam: 90,
      assignments: 10,
      labs: 0,
      projects: 0,
      seminars: 0,
      other: 0,
    });
    expect(segments[0].label).toBe("Exam 90%");
    expect(segments[1].label).toBe("10%");
  });

  it("carries seminars through with its own colour", () => {
    const segments = examinationSegments({
      exam: 0,
      assignments: 0,
      labs: 0,
      projects: 0,
      seminars: 100,
      other: 0,
    });
    expect(segments).toHaveLength(1);
    expect(segments[0].key).toBe("seminars");
    expect(segments[0].color).toBe(EXAMINATION_COLORS.seminars);
    expect(segments[0].ink).toBe(EXAMINATION_INK.seminars);
  });
});
