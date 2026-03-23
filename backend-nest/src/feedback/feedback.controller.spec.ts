import { Test, type TestingModule } from '@nestjs/testing';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';

describe('FeedbackController', () => {
  let controller: FeedbackController;
  let feedbackService: FeedbackService;

  const mockFeedbackService = {
    submitFeedback: jest.fn(),
  };

  const mockFeedbackData = {
    name: 'Sven',
    email: 'sven@kth.se',
    message: 'This is a test feedback message',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FeedbackController],
      providers: [
        {
          provide: FeedbackService,
          useValue: mockFeedbackService,
        },
      ],
    }).compile();

    controller = module.get<FeedbackController>(FeedbackController);
    feedbackService = module.get<FeedbackService>(FeedbackService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(feedbackService).toBeDefined();
  });

  describe('createFeedback', () => {
    it('should successfully create feedback', async () => {
      const expectedResult = { success: true };
      mockFeedbackService.submitFeedback.mockResolvedValue(expectedResult);

      const result = await controller.createFeedback(mockFeedbackData);

      expect(feedbackService.submitFeedback).toHaveBeenCalledWith(
        mockFeedbackData,
      );
      expect(result).toEqual(expectedResult);
    });
    it('should handle service errors', async () => {
      mockFeedbackService.submitFeedback.mockRejectedValue(
        new Error('Service error'),
      );

      await expect(controller.createFeedback(mockFeedbackData)).rejects.toThrow(
        'Service error',
      );
    });
  });
});
