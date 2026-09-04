import { beforeEach, describe, expect, it, vi } from "vitest";
import * as reviewsRepo from "../reviews/repository";
import * as takenRepo from "../taken/repository";
import * as savedRepo from "./repository";
import {
  isCourseSaved,
  listSavedCourseCodes,
  saveCourse,
  unsaveCourse,
} from "./service";

vi.mock("./repository");
vi.mock("../taken/repository");
vi.mock("../reviews/repository");

function assertUntouched(repo: Record<string, unknown>) {
  for (const [name, value] of Object.entries(repo)) {
    if (vi.isMockFunction(value)) {
      expect(value, `${name} must not be called`).not.toHaveBeenCalled();
    }
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("saved courses", () => {
  it("lists the course codes an app user has saved", async () => {
    vi.mocked(savedRepo.listSavedCourseCodes).mockResolvedValue([
      "SF1625",
      "DD2421",
    ]);

    await expect(listSavedCourseCodes("u1")).resolves.toEqual([
      "SF1625",
      "DD2421",
    ]);
  });

  it("saves a course and reports the state it ended in", async () => {
    const result = await saveCourse("u1", "DD2421");

    expect(savedRepo.insertSavedCourse).toHaveBeenCalledWith("u1", "DD2421");
    expect(result).toEqual({ courseCode: "DD2421", saved: true });
  });

  it("saving an already saved course is idempotent", async () => {
    await saveCourse("u1", "DD2421");
    const result = await saveCourse("u1", "DD2421");

    expect(result).toEqual({ courseCode: "DD2421", saved: true });
  });

  it("unsaves a course and reports the state it ended in", async () => {
    const result = await unsaveCourse("u1", "DD2421");

    expect(savedRepo.deleteSavedCourse).toHaveBeenCalledWith("u1", "DD2421");
    expect(result).toEqual({ courseCode: "DD2421", saved: false });
  });

  it("unsaving leaves taken history and reviews untouched", async () => {
    await unsaveCourse("u1", "DD2421");

    assertUntouched(takenRepo);
    assertUntouched(reviewsRepo);
  });

  it("reports whether a single course is saved", async () => {
    vi.mocked(savedRepo.findSavedCourse).mockResolvedValue({
      userId: "u1",
      courseCode: "DD2421",
      createdAt: new Date("2026-01-01"),
    });

    await expect(isCourseSaved("u1", "DD2421")).resolves.toBe(true);

    vi.mocked(savedRepo.findSavedCourse).mockResolvedValue(undefined);

    await expect(isCourseSaved("u1", "DD2421")).resolves.toBe(false);
  });
});
