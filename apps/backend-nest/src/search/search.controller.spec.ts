import { Test, type TestingModule } from "@nestjs/testing";
import type { CourseSummary } from "@shared/types";
import { SearchController } from "./search.controller";
import { SearchService } from "./search.service";

describe("SearchController", () => {
  let controller: SearchController;

  const mockSearchService = {
    searchCourses: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [
        {
          provide: SearchService,
          useValue: mockSearchService,
        },
      ],
    }).compile();

    controller = module.get<SearchController>(SearchController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("search", () => {
    const mockResults: CourseSummary[] = [
      {
        courseCode: "SF1625",
        titleEng: "Calculus in One Variable",
        currentStatus: "ESTABLISHED",
        credits: 7.5,
        creditUnit: "hp",
        department: "SF (SCI/Matematik) ",
        startTerms: [20252],
        examTypes: ["TEN1"],
        languages: ["english"],
        updatedAt: "2023-01-01T00:00:00.000Z",
      },
      {
        courseCode: "SF1624",
        titleEng: "Algebra and Geometry",
        currentStatus: "ESTABLISHED",
        credits: 7.5,
        creditUnit: "hp",
        department: "SF (SCI/Matematik) ",
        startTerms: [20251],
        examTypes: ["TEN1"],
        languages: ["english"],
        updatedAt: "2023-01-01T00:00:00.000Z",
      },
    ];

    it("returns SearchResponse with pagination and department filter", async () => {
      mockSearchService.searchCourses.mockResolvedValue(mockResults);

      const result = await controller.search(
        "algebra",
        "1",
        "10",
        "SF (SCI/Matematik) ",
      );

      expect(mockSearchService.searchCourses).toHaveBeenCalledWith(
        "algebra",
        10,
        { department: "SF (SCI/Matematik) ", minRating: undefined },
      );
      expect(result).toEqual({
        results: mockResults,
        total: 2,
        page: 1,
        pageSize: 10,
      });
    });

    it("defaults page to 1 and size to 10 when missing", async () => {
      mockSearchService.searchCourses.mockResolvedValue([]);

      const result = await controller.search("nonexistent");

      expect(mockSearchService.searchCourses).toHaveBeenCalledWith(
        "nonexistent",
        10,
        { department: undefined, minRating: undefined },
      );
      expect(result).toEqual({
        results: [],
        total: 0,
        page: 1,
        pageSize: 10,
      });
    });

    it("passes through minRating filter", async () => {
      mockSearchService.searchCourses.mockResolvedValue([]);
      await controller.search("math", "1", "20", undefined, "4");
      expect(mockSearchService.searchCourses).toHaveBeenCalledWith("math", 20, {
        department: undefined,
        minRating: 4,
      });
    });
  });
});
