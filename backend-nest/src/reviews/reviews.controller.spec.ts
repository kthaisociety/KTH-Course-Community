import { Test, type TestingModule } from "@nestjs/testing";
import { ReviewsController } from "./reviews.controller";
import { ReviewsService } from "./reviews.service";

describe("ReviewsController", () => {
  let controller: ReviewsController;
  let reviewsService: ReviewsService;

  const mockReviewsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    toggleVote: jest.fn(),
    removeVote: jest.fn(),
  };

  const mockReview = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    courseCode: "SF1625",
    rating: 4,
    comment: "Great course!",
    createdAt: new Date("2023-01-01"),
    updatedAt: new Date("2023-01-01"),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [
        {
          provide: ReviewsService,
          useValue: mockReviewsService,
        },
      ],
    }).compile();

    controller = module.get<ReviewsController>(ReviewsController);
    reviewsService = module.get<ReviewsService>(ReviewsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
    expect(reviewsService).toBeDefined();
  });

  describe("create", () => {
    it("should create new review", async () => {
      const mockCreateReview = {
        courseCode: "SF1625",
        userId: "user-123",
        easyScore: 4,
        usefulScore: 5,
        interestingScore: 3,
        wouldRecommend: true,
        content: "Great course!",
      };

      mockReviewsService.create.mockResolvedValue(mockReview);

      const result = await controller.create(mockCreateReview);

      expect(reviewsService.create).toHaveBeenCalledWith("SF1625", "user-123", {
        easyScore: 4,
        usefulScore: 5,
        interestingScore: 3,
        wouldRecommend: true,
        content: "Great course!",
      });
      expect(result).toEqual(mockReview);
    });
  });

  describe("findAll", () => {
    it("should return all reviews (without filters)", async () => {
      const mockReviews = [mockReview];
      mockReviewsService.findAll.mockResolvedValue(mockReviews);

      const result = await controller.findAll();

      expect(reviewsService.findAll).toHaveBeenCalledWith(undefined, undefined);
      expect(result).toEqual(mockReviews);
    });
  });

  describe("findOne", () => {
    it("should return one review", async () => {
      const reviewId = "123e4567-e89b-12d3-a456-426614174000";
      mockReviewsService.findOne.mockResolvedValue(mockReview);

      const result = await controller.findOne(reviewId);

      expect(reviewsService.findOne).toHaveBeenCalledWith(reviewId);
      expect(result).toEqual(mockReview);
    });
  });

  describe("update", () => {
    it("should update review", async () => {
      const mockUpdateReview = {
        easyScore: 5,
        usefulScore: 4,
        interestingScore: 3,
        wouldRecommend: true,
        content: "Updated content",
      };

      const reviewId = "123e4567-e89b-12d3-a456-426614174000";
      const updatedReview = { ...mockReview, ...mockUpdateReview };
      mockReviewsService.update.mockResolvedValue(updatedReview);

      const result = await controller.update(reviewId, mockUpdateReview);

      expect(reviewsService.update).toHaveBeenCalledWith(
        reviewId,
        mockUpdateReview,
      );
      expect(result).toEqual(updatedReview);
    });
  });

  describe("remove", () => {
    it("should remove review", async () => {
      const reviewId = "123e4567-e89b-12d3-a456-426614174000";
      const removeResult = { success: true };
      mockReviewsService.remove.mockResolvedValue(removeResult);

      const result = await controller.remove(reviewId);

      expect(reviewsService.remove).toHaveBeenCalledWith(reviewId);
      expect(result).toEqual(removeResult);
    });
  });

  describe("likeReview", () => {
    it("should like review", async () => {
      const reviewId = "123e4567-e89b-12d3-a456-426614174000";
      const userId = "user-123";
      const likeResult = { success: true, action: "liked" };
      mockReviewsService.toggleVote.mockResolvedValue(likeResult);

      const result = await controller.likeReview(reviewId, { userId });

      expect(reviewsService.toggleVote).toHaveBeenCalledWith(
        reviewId,
        userId,
        "like",
      );
      expect(result).toEqual(likeResult);
    });
  });

  describe("dislikeReview", () => {
    it("should dislike review", async () => {
      const reviewId = "123e4567-e89b-12d3-a456-426614174000";
      const userId = "user-123";
      const dislikeResult = { success: true, action: "disliked" };
      mockReviewsService.toggleVote.mockResolvedValue(dislikeResult);

      const result = await controller.dislikeReview(reviewId, { userId });

      expect(reviewsService.toggleVote).toHaveBeenCalledWith(
        reviewId,
        userId,
        "dislike",
      );
      expect(result).toEqual(dislikeResult);
    });
  });

  describe("removeVote", () => {
    it("should remove vote from review", async () => {
      const reviewId = "123e4567-e89b-12d3-a456-426614174000";
      const userId = "user-123";
      const removeVoteResult = { action: "removed", voteType: null };
      mockReviewsService.removeVote.mockResolvedValue(removeVoteResult);

      const result = await controller.removeVote(reviewId, { userId });

      expect(reviewsService.removeVote).toHaveBeenCalledWith(reviewId, userId);
      expect(result).toEqual(removeVoteResult);
    });
  });
});
