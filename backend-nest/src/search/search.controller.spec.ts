import { Test, type TestingModule } from "@nestjs/testing";
import { SearchController } from "./search.controller";
import { type SearchResult, SearchService } from "./search.service";

describe("SearchController", () => {
  let controller: SearchController;
  let searchService: SearchService;

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
    searchService = module.get<SearchService>(SearchService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
    expect(searchService).toBeDefined();
  });

  describe("search", () => {
    const mockSearchResults: SearchResult[] = [
      {
        _id: "1",
        _score: 1.5,
        course_name: "Calculus in One Variable",
        course_code: "SF1625",
        department: "SF (SCI/Matematik) ",
        goals: "Learn fundamentals of calculus",
        content: "Limits, derivatives, integrals",
        rating: 4,
      },
      {
        _id: "2",
        _score: 1.2,
        course_name: "Algebra and Geometry",
        course_code: "SF1624",
        department: "SF (SCI/Matematik) ",
        goals: "Learn algebra and geometry concepts",
        content: "Equations, shapes, theorems",
        rating: 5,
      },
    ];

    it("should return search results", async () => {
      mockSearchService.searchCourses.mockResolvedValue(mockSearchResults);

      const result = await controller.search(
        "algebra",
        "10",
        "SF (SCI/Matematik) ",
      );

      expect(searchService.searchCourses).toHaveBeenCalledWith("algebra", 10, {
        department: "SF (SCI/Matematik) ",
      });
      expect(result).toEqual({
        results: mockSearchResults,
        total: 2,
      });
    });

    it("should handle empty search results", async () => {
      mockSearchService.searchCourses.mockResolvedValue([]);

      const result = await controller.search("nonexistent");

      expect(searchService.searchCourses).toHaveBeenCalledWith(
        "nonexistent",
        10,
        { department: undefined },
      );
      expect(result).toEqual({
        results: [],
        total: 0,
      });
    });

    it("should pass department filter correctly", async () => {
      mockSearchService.searchCourses.mockResolvedValue(mockSearchResults);

      await controller.search("math", "20", "SF (SCI/Matematik) ");

      expect(searchService.searchCourses).toHaveBeenCalledWith("math", 20, {
        department: "SF (SCI/Matematik) ",
      });
    });
  });
});
