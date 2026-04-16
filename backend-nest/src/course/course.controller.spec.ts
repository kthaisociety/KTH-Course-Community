import { NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { SearchService } from "../search/search.service";
import { CourseController } from "./course.controller";
import { CourseService } from "./course.service";

describe("CourseController", () => {
  let controller: CourseController;

  const mockCourseService = {
    getSummary: jest.fn(),
    getDetails: jest.fn(),
  };

  const mockSearchService = {
    getCourseByCode: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CourseController],
      providers: [
        { provide: CourseService, useValue: mockCourseService },
        { provide: SearchService, useValue: mockSearchService },
      ],
    }).compile();

    controller = module.get<CourseController>(CourseController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("getCourseSummary", () => {
    it("returns the summary", async () => {
      const summary = {
        courseCode: "SF1625",
        titleEng: "Calculus in One Variable",
        currentStatus: "ESTABLISHED",
        credits: 7.5,
        creditUnit: "hp",
        department: "SF",
        startTerms: [20252, 20253],
        examTypes: ["TEN1"],
        languages: ["english"],
        updatedAt: "2023-01-01T00:00:00.000Z",
      };
      mockCourseService.getSummary.mockResolvedValue(summary);

      await expect(controller.getCourseSummary("SF1625")).resolves.toEqual(
        summary,
      );
      expect(mockCourseService.getSummary).toHaveBeenCalledWith("SF1625");
    });

    it("throws NotFoundException when absent", async () => {
      mockCourseService.getSummary.mockResolvedValue(null);
      await expect(controller.getCourseSummary("ABCD1234")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("getCourseDetails", () => {
    it("returns the details", async () => {
      const details = {
        courseCode: "SF1625",
        titleEng: "Calculus in One Variable",
        titleSwe: "Envariabelanalys",
        department: "SF",
        departmentCode: "SF",
        credits: 7.5,
        creditUnit: "hp",
        educationalLevel: "FIRST",
        gradeScale: "AF",
        goals: "...",
        content: "...",
        eligibility: "...",
        rounds: [
          {
            startTerm: 20252,
            formattedPeriodsAndCredits: "P1 (7,5 hp)",
            studyPace: 50,
            language: "english",
            tutoringForm: "NML",
            tutoringTime: "DAG",
            isProgrammeCourse: true,
            schemaURL: null,
          },
        ],
        examinations: [
          {
            examCode: "TEN1",
            title: "Tentamen",
            credits: 7.5,
            gradeScaleCode: "AF",
          },
        ],
      };
      mockCourseService.getDetails.mockResolvedValue(details);

      await expect(controller.getCourseDetails("SF1625")).resolves.toEqual(
        details,
      );
      expect(mockCourseService.getDetails).toHaveBeenCalledWith("SF1625");
    });

    it("throws NotFoundException when absent", async () => {
      mockCourseService.getDetails.mockResolvedValue(null);
      await expect(controller.getCourseDetails("ABCD1234")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("getElasticCourse", () => {
    it("returns the mapped document when found", async () => {
      const doc = {
        _id: "SF1625",
        course_code: "SF1625",
        course_name_swe: "Kalkyl",
        course_name_eng: "Calculus",
        department: "SF",
        credits: 7.5,
        goals: "g",
        content: "c",
        rating: 4,
      };
      mockSearchService.getCourseByCode.mockResolvedValue(doc);

      await expect(controller.getElasticCourse("SF1625")).resolves.toEqual({
        _id: "SF1625",
        courseCode: "SF1625",
        nameSwe: "Kalkyl",
        nameEng: "Calculus",
        department: "SF",
        credits: 7.5,
        goals: "g",
        content: "c",
        rating: 4,
      });
    });

    it("throws NotFoundException when document not found", async () => {
      mockSearchService.getCourseByCode.mockResolvedValue(null);
      await expect(controller.getElasticCourse("ABCD1234")).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
