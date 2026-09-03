import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, NotFoundError } from "../errors";
import { isCourseSaved } from "../saved/service";
import * as collectionsRepo from "./repository";
import {
  addCourseToCollection,
  createCollection,
  deleteCollection,
  listCollections,
  removeCourseFromCollection,
  renameCollection,
  reorderCollectionCourses,
} from "./service";

vi.mock("./repository");
vi.mock("../saved/service");

const createdAt = new Date("2026-01-01T00:00:00.000Z");
const collection = { id: "c1", userId: "u1", name: "Spring", createdAt };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(collectionsRepo.findCollection).mockResolvedValue(collection);
  vi.mocked(isCourseSaved).mockResolvedValue(true);
});

describe("listCollections", () => {
  it("groups each user's courses under their collection, in position order", async () => {
    vi.mocked(collectionsRepo.listCollections).mockResolvedValue([
      collection,
      { id: "c2", userId: "u1", name: "Autumn", createdAt },
    ]);
    vi.mocked(collectionsRepo.listCollectionCoursesForUser).mockResolvedValue([
      { collectionId: "c1", courseCode: "DD2421", position: 1 },
      { collectionId: "c2", courseCode: "DD1337", position: 0 },
      { collectionId: "c1", courseCode: "SF1625", position: 0 },
    ]);

    await expect(listCollections("u1")).resolves.toEqual([
      {
        id: "c1",
        name: "Spring",
        createdAt: "2026-01-01T00:00:00.000Z",
        courseCodes: ["SF1625", "DD2421"],
      },
      {
        id: "c2",
        name: "Autumn",
        createdAt: "2026-01-01T00:00:00.000Z",
        courseCodes: ["DD1337"],
      },
    ]);
  });
});

describe("collection lifecycle", () => {
  it("creates an empty collection owned by the caller", async () => {
    vi.mocked(collectionsRepo.insertCollection).mockResolvedValue(collection);

    const result = await createCollection("u1", "Spring");

    expect(collectionsRepo.insertCollection).toHaveBeenCalledWith({
      id: expect.any(String),
      userId: "u1",
      name: "Spring",
    });
    expect(result).toEqual({
      id: "c1",
      name: "Spring",
      createdAt: "2026-01-01T00:00:00.000Z",
      courseCodes: [],
    });
  });

  it("renames a collection the caller owns", async () => {
    vi.mocked(collectionsRepo.updateCollectionName).mockResolvedValue({
      ...collection,
      name: "Summer",
    });

    await expect(renameCollection("u1", "c1", "Summer")).resolves.toMatchObject(
      { id: "c1", name: "Summer" },
    );
  });

  it("hides a collection the caller does not own", async () => {
    vi.mocked(collectionsRepo.findCollection).mockResolvedValue(undefined);

    await expect(
      renameCollection("intruder", "c1", "Summer"),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(collectionsRepo.updateCollectionName).not.toHaveBeenCalled();
  });

  it("deletes a collection the caller owns", async () => {
    await expect(deleteCollection("u1", "c1")).resolves.toEqual({ id: "c1" });
    expect(collectionsRepo.deleteCollection).toHaveBeenCalledWith("u1", "c1");
  });
});

describe("collection membership", () => {
  it("rejects a course the owner has not saved", async () => {
    vi.mocked(isCourseSaved).mockResolvedValue(false);

    await expect(
      addCourseToCollection("u1", "c1", "DD2421"),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(collectionsRepo.appendCollectionCourse).not.toHaveBeenCalled();
  });

  it("appends a saved course, leaving position allocation to the repository", async () => {
    await expect(addCourseToCollection("u1", "c1", "DD2421")).resolves.toEqual({
      collectionId: "c1",
      courseCode: "DD2421",
    });

    expect(collectionsRepo.appendCollectionCourse).toHaveBeenCalledWith({
      collectionId: "c1",
      collectionUserId: "u1",
      courseCode: "DD2421",
    });
  });

  it("hides a collection the caller does not own from an add", async () => {
    vi.mocked(collectionsRepo.findCollection).mockResolvedValue(undefined);

    await expect(
      addCourseToCollection("intruder", "c1", "DD2421"),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(collectionsRepo.appendCollectionCourse).not.toHaveBeenCalled();
  });

  it("rejects removing a course the collection does not hold", async () => {
    vi.mocked(collectionsRepo.deleteCollectionCourse).mockResolvedValue(false);

    await expect(
      removeCourseFromCollection("u1", "c1", "DD2421"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("removes a course the collection holds", async () => {
    vi.mocked(collectionsRepo.deleteCollectionCourse).mockResolvedValue(true);

    await expect(
      removeCourseFromCollection("u1", "c1", "DD2421"),
    ).resolves.toEqual({ collectionId: "c1", courseCode: "DD2421" });
  });
});

describe("reorderCollectionCourses", () => {
  beforeEach(() => {
    vi.mocked(collectionsRepo.listCourseCodes).mockResolvedValue([
      "SF1625",
      "DD2421",
      "DD1337",
    ]);
  });

  it("applies the requested order", async () => {
    await reorderCollectionCourses("u1", "c1", ["DD1337", "DD2421", "SF1625"]);

    expect(collectionsRepo.setCoursePositions).toHaveBeenCalledWith("c1", [
      "DD1337",
      "DD2421",
      "SF1625",
    ]);
  });

  it("keeps unlisted courses after the ones that were listed", async () => {
    await reorderCollectionCourses("u1", "c1", ["DD1337"]);

    expect(collectionsRepo.setCoursePositions).toHaveBeenCalledWith("c1", [
      "DD1337",
      "SF1625",
      "DD2421",
    ]);
  });

  it("rejects a course the collection does not hold", async () => {
    await expect(
      reorderCollectionCourses("u1", "c1", ["EL1000"]),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(collectionsRepo.setCoursePositions).not.toHaveBeenCalled();
  });
});
