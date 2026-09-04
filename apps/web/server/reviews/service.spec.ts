import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors";
import * as reviewsRepo from "./repository";
import {
  createReview,
  findAllReviews,
  findOneReview,
  toggleVote,
  updateReview,
} from "./service";

vi.mock("./repository");

const review = {
  id: "review-123",
  userId: "user-456",
  courseCode: "SF1625",
  examinationDistribution: {
    exam: 50,
    assignments: 20,
    labs: 10,
    projects: 10,
    seminars: 5,
    other: 5,
  },
  approachTheoryPercent: 70,
  workloadScore: 8,
  learningScore: 9,
  happyTook: true,
  message: "Great course content!",
  createdAt: new Date("2023-01-01"),
  updatedAt: new Date("2023-01-01"),
};

describe("reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
        examinationDistribution: null,
        approachTheoryPercent: null,
        workloadScore: 1,
        learningScore: 1,
        happyTook: false,
        message: "nope",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("createReview refuses a second review of the same course", async () => {
    vi.mocked(reviewsRepo.findByUserAndCourse).mockResolvedValue(review);

    await expect(
      createReview("SF1625", "user-456", {
        examinationDistribution: null,
        approachTheoryPercent: null,
        workloadScore: 8,
        learningScore: 9,
        happyTook: true,
        message: null,
      }),
    ).rejects.toThrow(ValidationError);
    expect(reviewsRepo.insertReview).not.toHaveBeenCalled();
  });

  it("createReview round-trips a review through the target columns only", async () => {
    vi.mocked(reviewsRepo.findByUserAndCourse).mockResolvedValue(undefined);
    vi.mocked(reviewsRepo.insertReview).mockResolvedValue(review);

    const created = await createReview("SF1625", "user-456", {
      examinationDistribution: review.examinationDistribution,
      approachTheoryPercent: 70,
      workloadScore: 8,
      learningScore: 9,
      happyTook: true,
      message: "Great course content!",
    });

    expect(
      vi.mocked(reviewsRepo.insertReview).mock.calls[0]?.[0],
    ).toMatchObject({
      courseCode: "SF1625",
      userId: "user-456",
      examinationDistribution: review.examinationDistribution,
      approachTheoryPercent: 70,
      workloadScore: 8,
      learningScore: 9,
      happyTook: true,
      message: "Great course content!",
    });
    expect(created).toEqual({
      id: "review-123",
      userId: "user-456",
      courseCode: "SF1625",
      examinationDistribution: review.examinationDistribution,
      approachTheoryPercent: 70,
      workloadScore: 8,
      learningScore: 9,
      happyTook: true,
      message: "Great course content!",
      createdAt: "2023-01-01T00:00:00.000Z",
      updatedAt: "2023-01-01T00:00:00.000Z",
      upvoteCount: 0,
      downvoteCount: 0,
      userVote: null,
    });
  });

  it("createReview keeps an unremembered distribution and percent null", async () => {
    const forgetful = {
      ...review,
      examinationDistribution: null,
      approachTheoryPercent: null,
    };
    vi.mocked(reviewsRepo.insertReview).mockResolvedValue(forgetful);

    const created = await createReview("SF1625", "user-456", {
      examinationDistribution: null,
      approachTheoryPercent: null,
      workloadScore: 8,
      learningScore: 9,
      happyTook: true,
      message: "Great course content!",
    });

    const written = vi.mocked(reviewsRepo.insertReview).mock.calls[0]?.[0];
    expect(written?.examinationDistribution).toBeNull();
    expect(written?.approachTheoryPercent).toBeNull();
    expect(created.examinationDistribution).toBeNull();
    expect(created.approachTheoryPercent).toBeNull();
  });

  it("updateReview keeps an unremembered distribution and percent null", async () => {
    const forgetful = {
      ...review,
      examinationDistribution: null,
      approachTheoryPercent: null,
    };
    vi.mocked(reviewsRepo.findById).mockResolvedValue(review);
    vi.mocked(reviewsRepo.updateById).mockResolvedValue(forgetful);

    const updated = await updateReview("review-123", "user-456", {
      examinationDistribution: null,
      approachTheoryPercent: null,
      workloadScore: 3,
      learningScore: 4,
      happyTook: false,
      message: null,
    });

    const written = vi.mocked(reviewsRepo.updateById).mock.calls[0]?.[1];
    expect(written?.examinationDistribution).toBeNull();
    expect(written?.approachTheoryPercent).toBeNull();
    expect(updated.examinationDistribution).toBeNull();
    expect(updated.approachTheoryPercent).toBeNull();
  });

  it("createReview rejects a zero-filled distribution", async () => {
    await expect(
      createReview("SF1625", "user-456", {
        examinationDistribution: {
          exam: 0,
          assignments: 0,
          labs: 0,
          projects: 0,
          seminars: 0,
          other: 0,
        },
        approachTheoryPercent: 0,
        workloadScore: 8,
        learningScore: 9,
        happyTook: true,
        message: "Great course content!",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(reviewsRepo.insertReview).not.toHaveBeenCalled();
  });

  it("createReview rejects a distribution that does not add up to 100", async () => {
    await expect(
      createReview("SF1625", "user-456", {
        examinationDistribution: {
          ...review.examinationDistribution,
          exam: 40,
        },
        approachTheoryPercent: null,
        workloadScore: 8,
        learningScore: 9,
        happyTook: true,
        message: null,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(reviewsRepo.insertReview).not.toHaveBeenCalled();
  });

  it.each([0, 11, 5.5])(
    "createReview rejects %s as a score outside 1-10",
    async (score) => {
      await expect(
        createReview("SF1625", "user-456", {
          examinationDistribution: null,
          approachTheoryPercent: null,
          workloadScore: score,
          learningScore: 9,
          happyTook: true,
          message: null,
        }),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(reviewsRepo.insertReview).not.toHaveBeenCalled();
    },
  );

  it("createReview stores a blank message as null", async () => {
    vi.mocked(reviewsRepo.insertReview).mockResolvedValue({
      ...review,
      message: null,
    });

    await createReview("SF1625", "user-456", {
      examinationDistribution: null,
      approachTheoryPercent: null,
      workloadScore: 8,
      learningScore: 9,
      happyTook: true,
      message: "   ",
    });

    expect(vi.mocked(reviewsRepo.insertReview).mock.calls[0]?.[0].message).toBe(
      null,
    );
  });

  it("toggleVote records an upvote when the reviewer has not voted", async () => {
    vi.mocked(reviewsRepo.findVote).mockResolvedValue(undefined);

    const result = await toggleVote("review-123", "voter-1", "up");

    expect(reviewsRepo.upsertVote).toHaveBeenCalledWith(
      "review-123",
      "voter-1",
      "up",
    );
    expect(result).toEqual({ action: "added", voteType: "up" });
  });

  it("toggleVote flips an existing upvote to a downvote", async () => {
    vi.mocked(reviewsRepo.findVote).mockResolvedValue({
      voterUserId: "voter-1",
      reviewId: "review-123",
      voteType: "up",
      createdAt: new Date("2023-01-01"),
      updatedAt: new Date("2023-01-01"),
    });

    const result = await toggleVote("review-123", "voter-1", "down");

    expect(reviewsRepo.upsertVote).toHaveBeenCalledWith(
      "review-123",
      "voter-1",
      "down",
    );
    expect(result).toEqual({ action: "updated", voteType: "down" });
  });

  it("toggleVote removes a vote repeated in the same direction", async () => {
    vi.mocked(reviewsRepo.findVote).mockResolvedValue({
      voterUserId: "voter-1",
      reviewId: "review-123",
      voteType: "down",
      createdAt: new Date("2023-01-01"),
      updatedAt: new Date("2023-01-01"),
    });

    const result = await toggleVote("review-123", "voter-1", "down");

    expect(reviewsRepo.deleteVote).toHaveBeenCalledWith(
      "review-123",
      "voter-1",
    );
    expect(result).toEqual({ action: "removed", voteType: null });
  });

  it("two concurrent first votes both succeed", async () => {
    // A double-click is enough to get two requests past the same `findVote`.
    // A plain insert of the second would hit the composite primary key; the
    // conflict-aware set must not.
    const stored = new Map<string, string>();
    const key = (reviewId: string, voterUserId: string) =>
      `${voterUserId}:${reviewId}`;

    vi.mocked(reviewsRepo.findVote).mockResolvedValue(undefined);
    vi.mocked(reviewsRepo.upsertVote).mockImplementation(
      async (reviewId, voterUserId, voteType) => {
        stored.set(key(reviewId, voterUserId), voteType);
      },
    );

    const results = await Promise.all([
      toggleVote("review-123", "voter-1", "up"),
      toggleVote("review-123", "voter-1", "up"),
    ]);

    expect(results).toEqual([
      { action: "added", voteType: "up" },
      { action: "added", voteType: "up" },
    ]);
    expect([...stored.values()]).toEqual(["up"]);
  });

  it("findAllReviews tallies upvotes and downvotes separately", async () => {
    vi.mocked(reviewsRepo.listReviews).mockResolvedValue([
      {
        ...review,
        upvoteCount: "3",
        downvoteCount: "1",
        userVote: "down",
      },
    ]);

    const [first] = await findAllReviews("SF1625", "voter-1");

    expect(first).toMatchObject({
      upvoteCount: 3,
      downvoteCount: 1,
      userVote: "down",
    });
  });
});
