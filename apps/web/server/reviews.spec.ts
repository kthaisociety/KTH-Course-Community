import { describe, expect, it } from "vitest";
import type { Database } from "./db";
import { ForbiddenError, NotFoundError } from "./errors";
import { findOneReview, updateReview } from "./reviews";
import { createMockDb } from "./testing/mock-db";

const review = {
  id: "review-123",
  userId: "user-456",
  courseCode: "SF1625",
  examinationMethods: 4,
  theoreticalVsApplied: 5,
  workload: 3,
  learningExperience: 4,
  wouldRecommend: true,
  content: "Great course content!",
  createdAt: new Date("2023-01-01"),
  updatedAt: new Date("2023-01-01"),
};

describe("reviews", () => {
  it("findOneReview throws when missing", async () => {
    const db = createMockDb();
    db.queueResult([]);

    await expect(
      findOneReview(db as unknown as Database, "missing"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("updateReview forbids a non-author", async () => {
    const db = createMockDb();
    db.queueResult([review]);

    await expect(
      updateReview(db as unknown as Database, "review-123", "other-user", {
        examinationMethods: 1,
        theoreticalVsApplied: 1,
        workload: 1,
        learningExperience: 1,
        wouldRecommend: false,
        content: "nope",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
