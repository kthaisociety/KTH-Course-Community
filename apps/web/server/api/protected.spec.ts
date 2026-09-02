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
        examinationMethods: 3,
        theoreticalVsApplied: 3,
        workload: 3,
        learningExperience: 3,
        wouldRecommend: true,
        content: "hi",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("allows visitors on search.courses", async () => {
    const result = await caller(null).search.courses({ q: "" });
    expect(result).toMatchObject({ results: [], total: 0 });
  });
});
