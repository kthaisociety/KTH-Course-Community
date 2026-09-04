import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "../errors";
import * as takenRepo from "./repository";
import {
  addTakenCourse,
  listTakenCourses,
  recordTakenCourses,
  recordTranscriptCoursesIfAbsent,
  removeTakenCourse,
  updateTakenCourse,
} from "./service";

vi.mock("./repository");

const importedAt = new Date("2026-03-01T10:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(takenRepo.findTakenCourseCodes).mockResolvedValue([]);
});

describe("listTakenCourses", () => {
  it("serializes a taken course row", async () => {
    vi.mocked(takenRepo.listTakenCourses).mockResolvedValue([
      {
        userId: "u1",
        courseCode: "SF1625",
        grade: "B",
        earnedCredits: 7.5,
        attendancePeriods: "P2",
        attendanceYear: 2024,
        transcriptImportedAt: importedAt,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-02-01T00:00:00.000Z"),
      },
    ]);

    await expect(listTakenCourses("u1")).resolves.toEqual([
      {
        courseCode: "SF1625",
        grade: "B",
        earnedCredits: 7.5,
        attendancePeriods: "P2",
        attendanceYear: 2024,
        transcriptImportedAt: "2026-03-01T10:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z",
      },
    ]);
  });
});

describe("recordTakenCourses", () => {
  it("counts a course the user has not taken before as inserted", async () => {
    const result = await recordTakenCourses(
      "u1",
      [{ courseCode: "SF1625", grade: "B" }],
      { source: "manual" },
    );

    expect(result).toEqual({ inserted: 1, updated: 0 });
  });

  it("is idempotent on (userId, courseCode): a repeat call updates", async () => {
    vi.mocked(takenRepo.findTakenCourseCodes).mockResolvedValue(["SF1625"]);

    const result = await recordTakenCourses(
      "u1",
      [{ courseCode: "SF1625", grade: "A" }],
      { source: "manual" },
    );

    expect(result).toEqual({ inserted: 0, updated: 1 });
    expect(takenRepo.upsertTakenCourses).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(takenRepo.upsertTakenCourses).mock.calls[0][1],
    ).toHaveLength(1);
  });

  it("normalizes omitted self-reported fields to null", async () => {
    await recordTakenCourses("u1", [{ courseCode: "SF1625" }], {
      source: "manual",
    });

    expect(takenRepo.upsertTakenCourses).toHaveBeenCalledWith(
      "u1",
      [
        {
          courseCode: "SF1625",
          grade: null,
          earnedCredits: null,
          attendancePeriods: null,
          attendanceYear: null,
        },
      ],
      { mode: "preserve" },
    );
  });

  it("a transcript write stamps transcript_imported_at", async () => {
    await recordTakenCourses("u1", [{ courseCode: "SF1625" }], {
      source: "transcript",
      importedAt,
    });

    expect(vi.mocked(takenRepo.upsertTakenCourses).mock.calls[0][2]).toEqual({
      mode: "set",
      importedAt,
    });
  });

  it("a manual write preserves provenance instead of clearing it", async () => {
    vi.mocked(takenRepo.findTakenCourseCodes).mockResolvedValue(["SF1625"]);

    await recordTakenCourses("u1", [{ courseCode: "SF1625", grade: "A" }], {
      source: "manual",
    });

    expect(vi.mocked(takenRepo.upsertTakenCourses).mock.calls[0][2]).toEqual({
      mode: "preserve",
    });
  });

  it("collapses a course repeated inside one batch, last row winning", async () => {
    const result = await recordTakenCourses(
      "u1",
      [
        { courseCode: "SF1625", grade: "C" },
        { courseCode: "SF1625", grade: "A" },
      ],
      { source: "transcript", importedAt },
    );

    expect(result).toEqual({ inserted: 1, updated: 0 });
    expect(vi.mocked(takenRepo.upsertTakenCourses).mock.calls[0][1]).toEqual([
      expect.objectContaining({ courseCode: "SF1625", grade: "A" }),
    ]);
  });

  it("writes nothing for an empty batch", async () => {
    const result = await recordTakenCourses("u1", [], { source: "manual" });

    expect(result).toEqual({ inserted: 0, updated: 0 });
    expect(takenRepo.upsertTakenCourses).not.toHaveBeenCalled();
  });
});

describe("recordTranscriptCoursesIfAbsent", () => {
  it("uses an atomic insert-only write so an existing row is preserved", async () => {
    vi.mocked(takenRepo.insertTakenCoursesIfAbsent).mockResolvedValue([]);

    await expect(
      recordTranscriptCoursesIfAbsent(
        "u1",
        [{ courseCode: "SF1625", grade: "A" }],
        importedAt,
      ),
    ).resolves.toEqual({ inserted: 0, updated: 0 });

    expect(takenRepo.insertTakenCoursesIfAbsent).toHaveBeenCalledWith(
      "u1",
      [
        {
          courseCode: "SF1625",
          grade: "A",
          earnedCredits: null,
          attendancePeriods: null,
          attendanceYear: null,
        },
      ],
      importedAt,
    );
    expect(takenRepo.upsertTakenCourses).not.toHaveBeenCalled();
  });
});

describe("taken course edits", () => {
  it("addTakenCourse reports whether the row was new", async () => {
    await expect(
      addTakenCourse("u1", { courseCode: "SF1625", grade: "B" }),
    ).resolves.toEqual({ courseCode: "SF1625", created: true });
  });

  it("updateTakenCourse rejects a course the user has not taken", async () => {
    vi.mocked(takenRepo.updateTakenCourse).mockResolvedValue(false);

    await expect(
      updateTakenCourse("u1", { courseCode: "SF1625", grade: "B" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("updateTakenCourse never upserts, so a concurrent remove stands", async () => {
    vi.mocked(takenRepo.updateTakenCourse).mockResolvedValue(true);

    await updateTakenCourse("u1", { courseCode: "SF1625", grade: "B" });

    expect(takenRepo.updateTakenCourse).toHaveBeenCalledWith("u1", {
      courseCode: "SF1625",
      grade: "B",
      earnedCredits: null,
      attendancePeriods: null,
      attendanceYear: null,
    });
    expect(takenRepo.upsertTakenCourses).not.toHaveBeenCalled();
  });

  it("removeTakenCourse rejects a course the user has not taken", async () => {
    vi.mocked(takenRepo.deleteTakenCourse).mockResolvedValue(false);

    await expect(removeTakenCourse("u1", "SF1625")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("removeTakenCourse deletes an existing row", async () => {
    vi.mocked(takenRepo.deleteTakenCourse).mockResolvedValue(true);

    await expect(removeTakenCourse("u1", "SF1625")).resolves.toEqual({
      courseCode: "SF1625",
    });
  });
});
