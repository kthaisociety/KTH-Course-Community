import { ForbiddenException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { DRIZZLE } from "../db/drizzle.module";
import { ReviewsGateway } from "./reviews.gateway";
import { ReviewsService } from "./reviews.service";

type MockDb = {
  insert: jest.Mock;
  select: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  values: jest.Mock;
  from: jest.Mock;
  where: jest.Mock;
  limit: jest.Mock;
  set: jest.Mock;
  leftJoin: jest.Mock;
  orderBy: jest.Mock;
  returning: jest.Mock;
};

describe("ReviewsService", () => {
  let reviewsService: ReviewsService;
  let mockDb: MockDb;

  const mockReviewData = {
    examinationMethods: 4,
    theoreticalVsApplied: 5,
    workload: 3,
    learningExperience: 4,
    wouldRecommend: true,
    content: "Great course content!",
  };

  const mockInsertedReview = {
    id: "review-123",
    userId: "user-456",
    courseCode: "SF1625",
    ...mockReviewData,
    createdAt: new Date("2023-01-01"),
    updatedAt: new Date("2023-01-01"),
  };

  beforeEach(async () => {
    mockDb = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      returning: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        {
          provide: DRIZZLE,
          useValue: mockDb,
        },
        {
          provide: ReviewsGateway,
          useValue: { emitCourseChanged: jest.fn() },
        },
      ],
    }).compile();

    reviewsService = module.get<ReviewsService>(ReviewsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(reviewsService).toBeDefined();
  });

  describe("create", () => {
    it("should create new review", async () => {
      mockDb.returning.mockResolvedValue([mockInsertedReview]);

      const result = await reviewsService.create(
        "SF1625",
        "user-456",
        mockReviewData,
      );

      expect(result).toEqual(mockInsertedReview);
    });
  });

  describe("findAll", () => {
    it("should build query for reviews", () => {
      mockDb.where = jest.fn().mockReturnThis();

      reviewsService.findAll("SF1625");

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.orderBy).toHaveBeenCalled();
    });
  });

  describe("findOne", () => {
    it("should return one review", async () => {
      mockDb.limit.mockResolvedValue([mockInsertedReview]);

      const result = await reviewsService.findOne("review-123");

      expect(result).toEqual(mockInsertedReview);
    });
  });

  describe("update", () => {
    it("should update the author's own review", async () => {
      const updatedReview = { ...mockInsertedReview, ...mockReviewData };
      mockDb.limit.mockResolvedValue([mockInsertedReview]); // the author check
      mockDb.returning.mockResolvedValue([updatedReview]);

      const result = await reviewsService.update(
        "review-123",
        mockInsertedReview.userId,
        mockReviewData,
      );

      expect(result).toEqual(updatedReview);
    });

    it("should reject a caller who did not write the review", async () => {
      mockDb.limit.mockResolvedValue([mockInsertedReview]);

      await expect(
        reviewsService.update("review-123", "someone-else", mockReviewData),
      ).rejects.toThrow(ForbiddenException);
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("should delete the author's own review", async () => {
      mockDb.limit.mockResolvedValue([mockInsertedReview]); // the author check
      mockDb.returning.mockResolvedValue([mockInsertedReview]);

      const result = await reviewsService.remove(
        "review-123",
        mockInsertedReview.userId,
      );

      expect(result).toEqual(mockInsertedReview);
    });

    it("should reject a caller who did not write the review", async () => {
      mockDb.limit.mockResolvedValue([mockInsertedReview]);

      await expect(
        reviewsService.remove("review-123", "someone-else"),
      ).rejects.toThrow(ForbiddenException);
      expect(mockDb.delete).not.toHaveBeenCalled();
    });
  });

  // Toggle-tests
  describe("toggleVote", () => {
    it("should add new vote if no existing vote", async () => {
      mockDb.limit
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ courseCode: "SF1625" }]); // second mockResolve for the 'getRewvies' nested call
      mockDb.values.mockResolvedValue(undefined);

      const result = await reviewsService.toggleVote(
        "review-123",
        "user-456",
        "like",
      );

      expect(result).toEqual({ action: "added", voteType: "like" });
    });

    it("should remove vote if same vote type exists", async () => {
      const existingVote = {
        voteType: "like",
        userId: "user-456",
        reviewId: "review-123",
      };
      mockDb.limit
        .mockResolvedValueOnce([existingVote])
        .mockResolvedValueOnce([{ courseCode: "SF1625" }]);

      const result = await reviewsService.toggleVote(
        "review-123",
        "user-456",
        "like",
      );

      expect(result).toEqual({ action: "removed", voteType: null });
    });

    it("should update vote if different vote type exists", async () => {
      const existingVote = {
        voteType: "like",
        userId: "user-456",
        reviewId: "review-123",
      };
      mockDb.limit
        .mockResolvedValueOnce([existingVote])
        .mockResolvedValueOnce([{ courseCode: "SF1625" }]);

      const result = await reviewsService.toggleVote(
        "review-123",
        "user-456",
        "dislike",
      );

      expect(result).toEqual({ action: "updated", voteType: "dislike" });
    });
  });
});

jest.mock("../db/schema", () => ({
  reviews: {
    id: "reviews.id",
    userId: "reviews.userId",
    courseCode: "reviews.courseCode",
    examinationMethods: "reviews.examinationMethods",
    theoreticalVsApplied: "reviews.theoreticalVsApplied",
    workload: "reviews.workload",
    learningExperience: "reviews.learningExperience",
    wouldRecommend: "reviews.wouldRecommend",
    content: "reviews.content",
    createdAt: "reviews.createdAt",
    updatedAt: "reviews.updatedAt",
  },
  reviewLikes: {
    id: "reviewLikes.id",
    reviewId: "reviewLikes.reviewId",
    userId: "reviewLikes.userId",
    voteType: "reviewLikes.voteType",
    createdAt: "reviewLikes.createdAt",
  },
}));
