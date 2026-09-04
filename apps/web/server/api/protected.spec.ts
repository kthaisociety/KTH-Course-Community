import { describe, expect, it } from "vitest";
import { appRouter } from "./root";

function caller(session: { user: { id: string } } | null) {
  return appRouter.createCaller({
    session: session as never,
    headers: new Headers(),
  });
}

describe("protected procedures", () => {
  it("rejects visitors on user.delete", async () => {
    await expect(caller(null).user.delete()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("rejects visitors on reviews.create", async () => {
    await expect(
      caller(null).reviews.create({
        courseCode: "DD2421",
        examinationDistribution: null,
        approachTheoryPercent: null,
        workloadScore: 3,
        learningScore: 3,
        happyTook: true,
        message: "hi",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects visitors on reviews.vote", async () => {
    await expect(
      caller(null).reviews.vote({ id: "review-1", voteType: "up" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it.each([
    ["saved.list", () => caller(null).saved.list()],
    ["saved.save", () => caller(null).saved.save({ courseCode: "DD2421" })],
    ["saved.unsave", () => caller(null).saved.unsave({ courseCode: "DD2421" })],
    ["taken.list", () => caller(null).taken.list()],
    ["taken.add", () => caller(null).taken.add({ courseCode: "DD2421" })],
    ["taken.update", () => caller(null).taken.update({ courseCode: "DD2421" })],
    ["taken.remove", () => caller(null).taken.remove({ courseCode: "DD2421" })],
    ["collections.list", () => caller(null).collections.list()],
    [
      "collections.create",
      () => caller(null).collections.create({ name: "x" }),
    ],
    [
      "collections.rename",
      () => caller(null).collections.rename({ collectionId: "c1", name: "x" }),
    ],
    [
      "collections.delete",
      () => caller(null).collections.delete({ collectionId: "c1" }),
    ],
    [
      "collections.reorder",
      () =>
        caller(null).collections.reorder({
          collectionId: "c1",
          courseCodes: [],
        }),
    ],
    [
      "collections.addCourse",
      () =>
        caller(null).collections.addCourse({
          collectionId: "c1",
          courseCode: "DD2421",
        }),
    ],
    [
      "collections.removeCourse",
      () =>
        caller(null).collections.removeCourse({
          collectionId: "c1",
          courseCode: "DD2421",
        }),
    ],
  ])("rejects visitors on %s", async (_name, call) => {
    await expect(call()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("allows visitors on search.courses", async () => {
    const result = await caller(null).search.courses({ q: "" });
    expect(result).toMatchObject({ results: [], total: 0 });
  });
});
