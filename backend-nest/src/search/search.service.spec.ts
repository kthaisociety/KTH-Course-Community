import { Test, type TestingModule } from "@nestjs/testing";
import type { CourseSummary } from "@shared/types";
import { CourseService } from "../course/course.service";
import { DRIZZLE } from "../db/drizzle.module";
import { ES } from "./search.constants";
import { SearchService } from "./search.service";

describe("SearchService", () => {
  let service: SearchService;
  let mockEs: { search: jest.Mock };
  let mockDb: { execute: jest.Mock };
  let mockCourseService: { getSummariesByCodes: jest.Mock };

  const mockSummaries: CourseSummary[] = [
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

  const mockEsResponse = {
    hits: {
      hits: [
        { _id: "1", _score: 1.5, _source: { course_code: "SF1625" } },
        { _id: "2", _score: 1.2, _source: { course_code: "SF1624" } },
      ],
    },
  };

  beforeEach(async () => {
    mockEs = { search: jest.fn() };
    mockDb = { execute: jest.fn() };
    mockCourseService = { getSummariesByCodes: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: ES, useValue: mockEs },
        { provide: DRIZZLE, useValue: mockDb },
        { provide: CourseService, useValue: mockCourseService },
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
    it("returns empty array for empty query without hitting ES", async () => {
      const result = await service.searchCourses("", 10);
      expect(result).toEqual([]);
      expect(mockEs.search).not.toHaveBeenCalled();
    });

    it("fetches codes from ES then hydrates via CourseService", async () => {
      mockEs.search.mockResolvedValue(mockEsResponse);
      mockCourseService.getSummariesByCodes.mockResolvedValue(mockSummaries);

      const result = await service.searchCourses("algebra", 10);

      expect(mockCourseService.getSummariesByCodes).toHaveBeenCalledWith([
        "SF1625",
        "SF1624",
      ]);
      expect(result).toEqual(mockSummaries);
    });

    it("only requests course_code from ES _source", async () => {
      mockEs.search.mockResolvedValue({ hits: { hits: [] } });
      mockCourseService.getSummariesByCodes.mockResolvedValue([]);

      await service.searchCourses("algebra", 10);

      const call = mockEs.search.mock.calls[0][0] as { _source: string[] };
      expect(call._source).toEqual(["course_code"]);
    });

    it("applies department filter on ES query", async () => {
      mockEs.search.mockResolvedValue({ hits: { hits: [] } });
      mockCourseService.getSummariesByCodes.mockResolvedValue([]);

      await service.searchCourses("algebra", 10, {
        department: "SF (SCI/Matematik) ",
      });

      const call = mockEs.search.mock.calls[0][0] as {
        query: { bool: { filter: unknown[] } };
      };
      expect(call.query.bool.filter).toEqual([
        { wildcard: { department: "*SCI*" } },
      ]);
    });

    it("applies minRating by filtering codes via reviews table before hydration", async () => {
      mockEs.search.mockResolvedValue(mockEsResponse);
      mockDb.execute.mockResolvedValue({
        rows: [
          { course_code: "SF1625", rating: 3 },
          { course_code: "SF1624", rating: 5 },
        ],
      });
      mockCourseService.getSummariesByCodes.mockResolvedValue([
        mockSummaries[1],
      ]);

      const result = await service.searchCourses("math", 10, { minRating: 4 });

      expect(mockCourseService.getSummariesByCodes).toHaveBeenCalledWith([
        "SF1624",
      ]);
      expect(result).toEqual([mockSummaries[1]]);
    });

    it("propagates Elasticsearch errors", async () => {
      mockEs.search.mockRejectedValue(
        new Error("Elasticsearch connection failed"),
      );
      await expect(service.searchCourses("test")).rejects.toThrow(
        "Elasticsearch connection failed",
      );
    });
  });
});

jest.mock("../db/schema", () => ({
  reviews: { courseCode: "mocked_course_code_column" },
  courses: { code: "mocked_course_code" },
}));
