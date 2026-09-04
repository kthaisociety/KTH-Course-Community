import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CourseSummary } from "@/types";
import * as courseService from "../../course/service";
import { NotFoundError } from "../../errors";
import * as takenService from "../../taken/service";
import { buildTranscriptProposal, confirmTranscriptImport } from "./service";

vi.mock("../../course/service");
vi.mock("../../taken/service");

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
}

function catalogue(...codes: string[]): CourseSummary[] {
  return codes.map((courseCode) => ({
    courseCode,
    titleEng: `Title of ${courseCode}`,
    currentStatus: "ESTABLISHED",
    credits: 7.5,
    creditUnit: "hp",
    department: "Mathematics",
    startTerms: [],
    examTypes: [],
    languages: [],
    updatedAt: "2026-01-01T00:00:00.000Z",
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildTranscriptProposal", () => {
  it("proposes the catalogue courses and reports the codes it could not place", async () => {
    vi.mocked(courseService.getSummariesByCodes).mockResolvedValue(
      catalogue("SF1625", "DD1337", "SF1672", "DD1389"),
    );

    const proposal = await buildTranscriptProposal(
      fixture("ladok-english.txt"),
    );

    expect(proposal.candidates).toEqual([
      {
        courseCode: "SF1625",
        transcriptName: "Calculus in One Variable",
        catalogueName: "Title of SF1625",
        grade: "A",
        earnedCredits: 7.5,
        attendanceYear: 2023,
      },
      {
        courseCode: "DD1337",
        transcriptName: "Programming",
        catalogueName: "Title of DD1337",
        grade: "P",
        earnedCredits: 6,
        attendanceYear: 2023,
      },
      {
        courseCode: "SF1672",
        transcriptName: "Linear Algebra",
        catalogueName: "Title of SF1672",
        grade: "C",
        earnedCredits: 7.5,
        attendanceYear: 2024,
      },
      {
        courseCode: "DD1389",
        transcriptName:
          "Interactive Programming and Computer Games in Distributed Environments",
        catalogueName: "Title of DD1389",
        grade: "B",
        earnedCredits: 9,
        attendanceYear: 2024,
      },
    ]);
    expect(proposal.unmatched).toEqual([
      {
        courseCode: "ME1003",
        courseName: "Industrial Management, Basic Course",
      },
    ]);
  });

  it("writes nothing", async () => {
    vi.mocked(courseService.getSummariesByCodes).mockResolvedValue(
      catalogue("SF1625", "DD1337", "SF1672", "DD1389", "ME1003"),
    );

    await buildTranscriptProposal(fixture("ladok-english.txt"));

    expect(takenService.recordTranscriptCoursesIfAbsent).not.toHaveBeenCalled();
  });
});

describe("confirmTranscriptImport", () => {
  const importedAt = new Date("2026-09-04T10:00:00.000Z");

  const confirmed = [
    {
      courseCode: "SF1625",
      grade: "A",
      earnedCredits: 7.5,
      attendanceYear: 2023,
    },
    {
      courseCode: "DD1337",
      grade: "P",
      earnedCredits: 6,
      attendanceYear: 2023,
    },
  ];

  it("hands the confirmed rows to the taken service as a transcript import", async () => {
    vi.mocked(courseService.getSummariesByCodes).mockResolvedValue(
      catalogue("SF1625", "DD1337"),
    );
    vi.mocked(takenService.recordTranscriptCoursesIfAbsent).mockResolvedValue({
      inserted: 2,
      updated: 0,
    });

    const result = await confirmTranscriptImport(
      "user-1",
      confirmed,
      importedAt,
    );

    expect(takenService.recordTranscriptCoursesIfAbsent).toHaveBeenCalledTimes(
      1,
    );
    expect(takenService.recordTranscriptCoursesIfAbsent).toHaveBeenCalledWith(
      "user-1",
      [
        {
          courseCode: "SF1625",
          grade: "A",
          earnedCredits: 7.5,
          attendanceYear: 2023,
        },
        {
          courseCode: "DD1337",
          grade: "P",
          earnedCredits: 6,
          attendanceYear: 2023,
        },
      ],
      importedAt,
    );
    expect(result).toEqual({ inserted: 2, updated: 0 });
  });

  it("refuses a course code the catalogue does not have, and writes nothing", async () => {
    vi.mocked(courseService.getSummariesByCodes).mockResolvedValue(
      catalogue("SF1625"),
    );

    await expect(
      confirmTranscriptImport(
        "user-1",
        [...confirmed, { courseCode: "ZZ9999", grade: null }],
        importedAt,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(takenService.recordTranscriptCoursesIfAbsent).not.toHaveBeenCalled();
  });

  it("delegates repeated transcript confirmations to the insert-only write", async () => {
    vi.mocked(courseService.getSummariesByCodes).mockResolvedValue(
      catalogue("SF1625", "DD1337"),
    );
    vi.mocked(takenService.recordTranscriptCoursesIfAbsent).mockResolvedValue({
      inserted: 0,
      updated: 0,
    });

    await confirmTranscriptImport("user-1", confirmed, importedAt);
    await confirmTranscriptImport("user-1", confirmed, importedAt);

    expect(takenService.recordTranscriptCoursesIfAbsent).toHaveBeenCalledTimes(
      2,
    );
    for (const [, rows] of vi.mocked(
      takenService.recordTranscriptCoursesIfAbsent,
    ).mock.calls) {
      expect(rows.map((row) => row.courseCode)).toEqual(["SF1625", "DD1337"]);
    }
  });

  it("normalises a course code before checking it against the catalogue", async () => {
    vi.mocked(courseService.getSummariesByCodes).mockResolvedValue(
      catalogue("SF1625"),
    );
    vi.mocked(takenService.recordTranscriptCoursesIfAbsent).mockResolvedValue({
      inserted: 1,
      updated: 0,
    });

    await confirmTranscriptImport(
      "user-1",
      [{ courseCode: " sf1625 ", grade: "A" }],
      importedAt,
    );

    const [, rows] = vi.mocked(takenService.recordTranscriptCoursesIfAbsent)
      .mock.calls[0];
    expect(rows).toEqual([
      {
        courseCode: "SF1625",
        grade: "A",
        earnedCredits: null,
        attendanceYear: null,
      },
    ]);
  });

  it("writes nothing when the user confirms no courses", async () => {
    const result = await confirmTranscriptImport("user-1", [], importedAt);

    expect(result).toEqual({ inserted: 0, updated: 0 });
    expect(takenService.recordTranscriptCoursesIfAbsent).not.toHaveBeenCalled();
    expect(courseService.getSummariesByCodes).not.toHaveBeenCalled();
  });
});
