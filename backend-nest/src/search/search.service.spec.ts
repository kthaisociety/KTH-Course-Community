import { Logger } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { CourseSummary } from "@shared/types";
import { AiService } from "../ai/ai.service";
import { CourseService } from "../course/course.service";
import { DRIZZLE } from "../db/drizzle.module";
import { ES } from "./search.constants";
import { SearchService } from "./search.service";

describe("SearchService", () => {
  let service: SearchService;
  let mockEs: { search: jest.Mock };
  let mockDb: { execute: jest.Mock };
  let mockCourseService: { getSummariesByCodes: jest.Mock };
  let mockAiService: { embedSingle: jest.Mock };

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

  describe("with Elasticsearch", () => {
    beforeEach(async () => {
      mockEs = { search: jest.fn() };
      mockDb = { execute: jest.fn() };
      mockCourseService = { getSummariesByCodes: jest.fn() };
      mockAiService = {
        embedSingle: jest.fn().mockResolvedValue({
          embedding: new Array(1536).fill(0),
          usage: {},
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SearchService,
          { provide: ES, useValue: mockEs },
          { provide: DRIZZLE, useValue: mockDb },
          { provide: CourseService, useValue: mockCourseService },
          { provide: AiService, useValue: mockAiService },
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

        const result = await service.searchCourses("math", 10, {
          minRating: 4,
        });

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

  describe("without Elasticsearch", () => {
    const embedding1536 = () => new Array(1536).fill(0.01);

    beforeEach(async () => {
      mockDb = { execute: jest.fn() };
      mockCourseService = { getSummariesByCodes: jest.fn() };
      mockAiService = {
        embedSingle: jest.fn().mockResolvedValue({
          embedding: embedding1536(),
          usage: {},
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SearchService,
          { provide: ES, useValue: null },
          { provide: DRIZZLE, useValue: mockDb },
          { provide: CourseService, useValue: mockCourseService },
          { provide: AiService, useValue: mockAiService },
        ],
      }).compile();

      service = module.get<SearchService>(SearchService);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it("merges keyword and semantic hits with keyword-first deduplication", async () => {
      mockDb.execute
        .mockResolvedValueOnce({
          rows: [{ code: "DD1001" }, { code: "DD1002" }],
        })
        .mockResolvedValueOnce({
          rows: [
            { code: "DD1002", score: 0.91 },
            { code: "DD1003", score: 0.82 },
          ],
        });

      const summaries: CourseSummary[] = [
        { ...mockSummaries[0], courseCode: "DD1001", titleEng: "One" },
        { ...mockSummaries[1], courseCode: "DD1002", titleEng: "Two" },
        {
          ...mockSummaries[0],
          courseCode: "DD1003",
          titleEng: "Three",
        },
      ];
      mockCourseService.getSummariesByCodes.mockResolvedValue(summaries);

      const result = await service.searchCourses("machine learning", 10);

      expect(mockAiService.embedSingle).toHaveBeenCalledWith(
        "machine learning",
      );
      expect(mockDb.execute).toHaveBeenCalledTimes(2);
      expect(mockCourseService.getSummariesByCodes).toHaveBeenCalledWith([
        "DD1001",
        "DD1002",
        "DD1003",
      ]);
      expect(result).toEqual(summaries);
    });

    it("reuses embedding from cache on repeated identical queries", async () => {
      mockDb.execute.mockResolvedValue({ rows: [{ code: "C1" }] });

      await service.searchCourses("  Deep Learning  ", 5);
      await service.searchCourses("deep learning", 5);

      expect(mockAiService.embedSingle).toHaveBeenCalledTimes(1);
      expect(mockAiService.embedSingle).toHaveBeenCalledWith(
        "  Deep Learning  ",
      );
      expect(mockDb.execute).toHaveBeenCalledTimes(4);
    });

    it("shares one embed call when two searches for the same key run concurrently", async () => {
      mockAiService.embedSingle.mockImplementation(async () => {
        await new Promise<void>((r) => {
          setImmediate(r);
        });
        return { embedding: embedding1536(), usage: {} };
      });
      mockDb.execute.mockResolvedValue({ rows: [{ code: "X1" }] });

      await Promise.all([
        service.searchCourses("overlap", 10),
        service.searchCourses("overlap", 10),
      ]);

      expect(mockAiService.embedSingle).toHaveBeenCalledTimes(1);
    });

    it("applies minRating using reviews query after DB keyword+semantic merge", async () => {
      mockDb.execute
        .mockResolvedValueOnce({
          rows: [{ code: "LOW" }, { code: "HIGH" }],
        })
        .mockResolvedValueOnce({
          rows: [{ code: "HIGH", score: 0.5 }],
        })
        .mockResolvedValueOnce({
          rows: [
            { course_code: "LOW", rating: 2 },
            { course_code: "HIGH", rating: 5 },
          ],
        });

      mockCourseService.getSummariesByCodes.mockResolvedValue([
        { ...mockSummaries[0], courseCode: "HIGH", titleEng: "Rated" },
      ]);

      const result = await service.searchCourses("stats", 10, { minRating: 4 });

      expect(mockDb.execute).toHaveBeenCalledTimes(3);
      expect(mockCourseService.getSummariesByCodes).toHaveBeenCalledWith([
        "HIGH",
      ]);
      expect(result).toEqual([
        { ...mockSummaries[0], courseCode: "HIGH", titleEng: "Rated" },
      ]);
    });

    it("returns keyword-only and logs when semantic vector query fails after embed", async () => {
      const warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation();
      mockDb.execute
        .mockResolvedValueOnce({
          rows: [{ code: "KTH101" }],
        })
        .mockRejectedValueOnce(new Error("vector query failed"));

      mockCourseService.getSummariesByCodes.mockResolvedValue([
        { ...mockSummaries[0], courseCode: "KTH101", titleEng: "Solo" },
      ]);

      const result = await service.searchCourses("calculus", 10);

      expect(mockAiService.embedSingle).toHaveBeenCalledWith("calculus");
      expect(mockDb.execute).toHaveBeenCalledTimes(2);
      expect(mockCourseService.getSummariesByCodes).toHaveBeenCalledWith([
        "KTH101",
      ]);
      expect(result).toEqual([
        { ...mockSummaries[0], courseCode: "KTH101", titleEng: "Solo" },
      ]);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Embedding search failed, returning \[\]/),
      );
      warnSpy.mockRestore();
    });
  });
});

jest.mock("../db/schema", () => ({
  reviews: { courseCode: "mocked_course_code_column" },
  courses: { code: "mocked_course_code" },
}));
