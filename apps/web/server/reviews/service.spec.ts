import { describe, expect, it, vi } from "vitest";
import { ForbiddenError, NotFoundError } from "../errors";
import * as reviewsRepo from "./repository";
import { findOneReview, updateReview } from "./service";

vi.mock("./repository");

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
    vi.mocked(reviewsRepo.findById).mockResolvedValue(undefined);

    await expect(findOneReview("missing")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("updateReview forbids a non-author", async () => {
    vi.mocked(reviewsRepo.findById).mockResolvedValue(review);

    await expect(
      updateReview("review-123", "other-user", {
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
