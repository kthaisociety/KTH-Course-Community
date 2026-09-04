import { describe, expect, it } from "vitest";
import {
  creditsLabel,
  draftEdits,
  lastTranscriptImport,
  type ProposalRow,
  parseCredits,
  parseYear,
  type TakenCourse,
  takenUpdateInput,
  toConfirmedCourses,
  toTakenRows,
} from "./taken-rows";

function takenCourse(overrides: Partial<TakenCourse> = {}): TakenCourse {
  return {
    courseCode: "DD1337",
    grade: "B",
    earnedCredits: 7.5,
    attendancePeriods: "P1",
    attendanceYear: 2025,
    transcriptImportedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function proposalRow(overrides: Partial<ProposalRow> = {}): ProposalRow {
  return {
    courseCode: "DD1337",
    transcriptName: "Programmering",
    catalogueName: "Programming",
    grade: "B",
    earnedCredits: 7.5,
    attendanceYear: 2025,
    ...overrides,
  };
}

describe("toTakenRows", () => {
  it("names a course from the catalogue", () => {
    const rows = toTakenRows(
      [takenCourse()],
      new Map([["DD1337", "Introduction to Computer Science"]]),
    );
    expect(rows[0].name).toBe("Introduction to Computer Science");
  });

  it("falls back to the course code, because a taken row stores no title", () => {
    const rows = toTakenRows([takenCourse()], new Map());
    expect(rows[0].name).toBe("DD1337");
  });
});

describe("lastTranscriptImport", () => {
  it("is null when every row was entered by hand", () => {
    expect(lastTranscriptImport([takenCourse()])).toBeNull();
  });

  it("is the most recent import stamp on the list", () => {
    const at = lastTranscriptImport([
      takenCourse({ transcriptImportedAt: "2026-08-24T09:00:00.000Z" }),
      takenCourse({
        courseCode: "DD2380",
        transcriptImportedAt: "2027-01-18T09:00:00.000Z",
      }),
      takenCourse({ courseCode: "SF1625" }),
    ]);
    expect(at).toBe("2027-01-18T09:00:00.000Z");
  });
});

describe("takenUpdateInput", () => {
  it("carries the stored attendance periods through an edit that cannot see them", () => {
    const input = takenUpdateInput(
      takenCourse({ attendancePeriods: "P3, P4" }),
      { grade: "A", earnedCredits: 9, attendanceYear: 2024 },
    );
    expect(input).toEqual({
      courseCode: "DD1337",
      grade: "A",
      earnedCredits: 9,
      attendanceYear: 2024,
      attendancePeriods: "P3, P4",
    });
  });

  it("clears a field the reader emptied", () => {
    const input = takenUpdateInput(takenCourse(), {
      grade: null,
      earnedCredits: null,
      attendanceYear: null,
    });
    expect(input.grade).toBeNull();
    expect(input.earnedCredits).toBeNull();
  });
});

describe("toConfirmedCourses", () => {
  it("keeps the transcript's grades when the reader asked for them", () => {
    expect(toConfirmedCourses([proposalRow()], true)).toEqual([
      {
        courseCode: "DD1337",
        grade: "B",
        earnedCredits: 7.5,
        attendanceYear: 2025,
      },
    ]);
  });

  it("drops every grade when the reader did not, and keeps the rest", () => {
    const [confirmed] = toConfirmedCourses([proposalRow()], false);
    expect(confirmed.grade).toBeNull();
    expect(confirmed.earnedCredits).toBe(7.5);
    expect(confirmed.attendanceYear).toBe(2025);
  });

  it("never sends a name: a taken course has none to store", () => {
    const [confirmed] = toConfirmedCourses([proposalRow()], true);
    expect(Object.keys(confirmed).sort()).toEqual([
      "attendanceYear",
      "courseCode",
      "earnedCredits",
      "grade",
    ]);
  });
});

describe("parseCredits", () => {
  it.each([
    ["", null],
    ["7.5", 7.5],
    ["7,5", 7.5],
    ["0", 0],
  ])("reads %j as %j", (text, expected) => {
    expect(parseCredits(text)).toBe(expected);
  });

  it.each(["abc", "-1", "1001"])("refuses %j", (text) => {
    expect(parseCredits(text)).toBeUndefined();
  });
});

describe("parseYear", () => {
  it("reads an empty box as cleared", () => {
    expect(parseYear("")).toBeNull();
  });

  it("reads a four-digit year", () => {
    expect(parseYear("2025")).toBe(2025);
  });

  it.each(["25", "20255", "1899", "2201", "20x5"])("refuses %j", (text) => {
    expect(parseYear(text)).toBeUndefined();
  });
});

describe("draftEdits", () => {
  it("upper-cases a grade and leaves it unvalidated", () => {
    expect(draftEdits({ grade: "b", credits: "6", year: "2024" })).toEqual({
      grade: "B",
      earnedCredits: 6,
      attendanceYear: 2024,
    });
  });

  it("is null while a box holds something unreadable", () => {
    expect(draftEdits({ grade: "A", credits: "six", year: "2024" })).toBeNull();
    expect(draftEdits({ grade: "A", credits: "6", year: "24" })).toBeNull();
  });
});

describe("creditsLabel", () => {
  it("says nothing where the student reported nothing", () => {
    expect(creditsLabel(null)).toBe("—");
  });

  it("labels credits in hp", () => {
    expect(creditsLabel(7.5)).toBe("7.5 hp");
  });
});
