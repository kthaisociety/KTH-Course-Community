import { Test, type TestingModule } from "@nestjs/testing";
import { DRIZZLE } from "../database/drizzle.module";
import { ES } from "./search.constants";
import { type SearchResult, SearchService } from "./search.service";

describe("SearchService", () => {
  let service: SearchService;
  let mockEs: any;
  let mockDb: any;

  beforeEach(async () => {
    mockEs = {
      search: jest.fn(),
    };

    mockDb = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: ES,
          useValue: mockEs,
        },
        {
          provide: DRIZZLE,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("searchCourses", () => {
    const mockEsResponse = {
      hits: {
        hits: [
          {
            _id: "1",
            _score: 1.5,
            _source: {
              course_name: "Calculus in One Variable",
              course_code: "SF1625",
              department: "SF (SCI/Matematik) ",
              goals: "Learn fundamentals of calculus",
              content: "Limits, derivatives, integrals",
              rating: 4,
            },
          },
          {
            _id: "2",
            _score: 1.2,
            _source: {
              course_name: "Algebra and Geometry",
              course_code: "SF1624",
              department: "SF (SCI/Matematik) ",
              goals: "Learn algebra and geometry concepts",
              content: "Equations, shapes, theorems",
            },
          },
        ],
      },
    };

    const mockDbRatingResponse = {
      rows: [
        { course_code: "SF1625", rating: 4 },
        { course_code: "SF1624", rating: 5 },
      ],
    };

    it("should search courses and return results", async () => {
      mockEs.search.mockResolvedValue(mockEsResponse);
      mockDb.execute.mockResolvedValue(mockDbRatingResponse);

      const result = await service.searchCourses("algebra", 10);

      expect(mockEs.search).toHaveBeenCalledWith({
        index: "courses",
        size: 10,
        query: {
          bool: {
            should: [
              { prefix: { course_code: "ALGEBRA" } },
              { wildcard: { course_code: "*ALGEBRA*" } },
              {
                multi_match: {
                  query: "algebra",
                  fields: ["course_name^2"],
                  type: "phrase_prefix",
                },
              },
              {
                multi_match: {
                  query: "algebra",
                  fields: ["course_name^2", "course_code^2", "goals", "content"],
                  fuzziness: "AUTO",
                  type: "best_fields",
                },
              },
            ],
            minimum_should_match: 1,
            filter: [],
          },
        },
        _source: [
          "course_name",
          "course_code",
          "department",
          "goals",
          "content",
        ],
      });

      expect(mockDb.execute).toHaveBeenCalled();

      const expectedResult: SearchResult[] = [
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

      expect(result).toEqual(expectedResult);
    });

    it("should handle department filter", async () => {
      mockEs.search.mockResolvedValue(mockEsResponse);
      mockDb.execute.mockResolvedValue(mockDbRatingResponse);

      await service.searchCourses("algebra", 10, {
        department: "SF (SCI/Matematik) ",
      });

      expect(mockEs.search).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            bool: expect.objectContaining({
              filter: [{ wildcard: { department: "*SCI*" } }],
            }),
          }),
        }),
      );
    });

    // failing test
    it("should handle minRating filter", async () => {
      mockEs.search.mockResolvedValue(mockEsResponse);
      mockDb.execute.mockResolvedValue(mockDbRatingResponse);

      const result = await service.searchCourses("math", 10, { minRating: 4 });
      expect(result.every((r) => r.rating! >= 4)).toBe(true);
    });

    it("should handle Elasticsearch errors", async () => {
      const error = new Error("Elasticsearch connection failed");
      mockEs.search.mockRejectedValue(error);

      await expect(service.searchCourses("test")).rejects.toThrow(
        "Elasticsearch connection failed",
      );
    });

    it("should handle database errors", async () => {
      mockEs.search.mockResolvedValue(mockEsResponse);
      const dbError = new Error("Database connection failed");
      mockDb.execute.mockRejectedValue(dbError);

      await expect(service.searchCourses("test")).rejects.toThrow(
        "Database connection failed",
      );
    });
  });

  describe("getCourseByCode", () => {
    const mockCourseData = {
      _id: "SF1624",
      course_name: "Linear Algebra",
      course_code: "SF1624",
      department: "SF (SCI/Matematik) ",
      goals: "Learn linear algebra and geometry concepts",
      content: "Vectors, matrices, linear transformations",
      rating: 4,
    };

    it("should return course data when course exists", async () => {
      const mockResponse = {
        hits: {
          hits: [
            {
              _id: "SF1624",
              _source: mockCourseData,
            },
          ],
        },
      };
      mockEs.search.mockResolvedValue(mockResponse);
      mockDb.execute.mockResolvedValue({ rows: [{ rating: 4 }] });

      const result = await service.getCourseByCode("SF1624");

      expect(mockEs.search).toHaveBeenCalledWith({
        index: "courses",
        size: 1,
        query: {
          term: {
            course_code: "SF1624",
          },
        },
      });
      expect(result).toEqual(mockCourseData);
    });

    it("should handle Elasticsearch errors", async () => {
      const error = new Error("Elasticsearch connection failed");
      mockEs.search.mockRejectedValue(error);

      await expect(service.getCourseByCode("SF1624")).rejects.toThrow(
        "Elasticsearch connection failed",
      );
    });
  });
});

jest.mock("../../../types/database/schema", () => ({
  reviews: {
    courseCode: "mocked_course_code_column",
  },
  courses: {
    code: "mocked_course_code",
  },
}));
