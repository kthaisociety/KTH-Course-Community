import { Test, type TestingModule } from "@nestjs/testing";
import { DRIZZLE } from "../database/drizzle.module";
import { FeedbackService } from "./feedback.service";

type MockDb = {
  insert: jest.Mock;
  values: jest.Mock;
};

describe("FeedbackService", () => {
  let feedbackService: FeedbackService;
  let mockDb: MockDb;

  const mockFeedbackData = {
    name: "Sven",
    email: "sven@kth.se",
    message: "This is a test feedback message",
  };

  beforeEach(async () => {
    mockDb = {
      insert: jest.fn().mockReturnThis(),
      values: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedbackService,
        {
          provide: DRIZZLE,
          useValue: mockDb,
        },
      ],
    }).compile();

    feedbackService = module.get<FeedbackService>(FeedbackService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(feedbackService).toBeDefined();
  });

  describe("submitFeedback", () => {
    it("should successfully submit feedback", async () => {
      const result = await feedbackService.submitFeedback(mockFeedbackData);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Sven",
          email: "sven@kth.se",
          message: "This is a test feedback message",
          id: expect.any(String),
        }),
      );
      expect(result).toEqual({ success: true });
    });

    it("should handle database errors", async () => {
      mockDb.values.mockRejectedValue(new Error("Database connection failed"));

      await expect(
        feedbackService.submitFeedback(mockFeedbackData),
      ).rejects.toThrow("Database connection failed");
    });
  });
});
