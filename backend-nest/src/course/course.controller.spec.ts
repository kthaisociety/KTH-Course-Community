import { NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { SearchService } from "../search/search.service";
import { CourseController } from "./course.controller";
import { CourseService } from "./course.service";

describe("CourseController", () => {
  let controller: CourseController;
  let courseService: CourseService;
  let searchService: SearchService;

  const mockCourseService = {
    getCourse: jest.fn(),
    courseCodeExists: jest.fn(),
    getCourseCredits: jest.fn(),
  };

  const mockSearchService = {
    getCourseByCode: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CourseController],
      providers: [
        {
          provide: CourseService,
          useValue: mockCourseService,
        },
        {
          provide: SearchService,
          useValue: mockSearchService,
        },
      ],
    }).compile();

    controller = module.get<CourseController>(CourseController);
    courseService = module.get<CourseService>(CourseService);
    searchService = module.get<SearchService>(SearchService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
    expect(courseService).toBeDefined();
    expect(searchService).toBeDefined();
  });

  describe("getNeonCourse", () => {
    it("should return course data", async () => {
      const mockCourse = {
        code: "SF1625",
        department: "SF (SCI/Matematik) ",
        name: "Calculus in One Variable",
        state: "ESTABLISHED",
        updatedAt: new Date("2023-01-01"),
      };

      mockCourseService.getCourse.mockResolvedValue(mockCourse);

      const result = await controller.getNeonCourse("SF1625");

      expect(courseService.getCourse).toHaveBeenCalledWith("SF1625");
      expect(result).toEqual({
        courseCode: "SF1625",
        department: "SF (SCI/Matematik) ",
        name: "Calculus in One Variable",
        currentStatus: "ESTABLISHED",
        lastExaminationSemester: null,
        updatedAt: mockCourse.updatedAt,
      });
    });

    it("should throw NotFoundException when course does not exist", async () => {
      mockCourseService.getCourse.mockResolvedValue(null);

      await expect(controller.getNeonCourse("ABCD1234")).rejects.toThrow(
        new NotFoundException(
          "Course with code ABCD1234 not found in database.",
        ),
      );

      expect(courseService.getCourse).toHaveBeenCalledWith("ABCD1234");
    });
  });

  describe("getElasticCourse", () => {
    it("should return course document when found", async () => {
      const mockCourseDocument = {
        course_code: "SF1625",
        department: "SF (SCI/Matematik) ",
        course_name: "Calculus in One Variable",
        goals: "Fundamentals of calculus",
        content: "Limits, derivatives, integrals",
      };

      mockSearchService.getCourseByCode.mockResolvedValue(mockCourseDocument);

      const result = await controller.getElasticCourse("SF1625");

      expect(searchService.getCourseByCode).toHaveBeenCalledWith("SF1625");
      expect(result).toEqual({
        courseCode: "SF1625",
        department: "SF (SCI/Matematik) ",
        name: "Calculus in One Variable",
        goals: "Fundamentals of calculus",
        content: "Limits, derivatives, integrals",
      });
    });

    it("should throw NotFoundException when course document not found", async () => {
      mockSearchService.getCourseByCode.mockResolvedValue(null);

      await expect(controller.getElasticCourse("ABCD1234")).rejects.toThrow(
        new NotFoundException(
          "Course with code ABCD1234 not found in database.",
        ),
      );

      expect(searchService.getCourseByCode).toHaveBeenCalledWith("ABCD1234");
    });
  });

  describe("checkIfCourseCodeExists", () => {
    it("should return exists: true if course exists", async () => {
      mockCourseService.courseCodeExists.mockResolvedValue(true);

      const result = await controller.checkIfCourseCodeExists("SF1625");

      expect(courseService.courseCodeExists).toHaveBeenCalledWith("SF1625");
      expect(result).toEqual({ exists: true });
    });

    it("should return exists: false if course does not exist", async () => {
      mockCourseService.courseCodeExists.mockResolvedValue(false);

      const result = await controller.checkIfCourseCodeExists("ABCD1234");

      expect(courseService.courseCodeExists).toHaveBeenCalledWith("ABCD1234");
      expect(result).toEqual({ exists: false });
    });
  });

  describe("getCourseCredits", () => {
    it("should return course credits", async () => {
      mockCourseService.getCourseCredits.mockResolvedValue(7.5);

      const result = await controller.getCourseCredits("SF1625");

      expect(courseService.getCourseCredits).toHaveBeenCalledWith("SF1625");
      expect(result).toEqual({ credits: 7.5 });
    });

    it("should handle null credits", async () => {
      mockCourseService.getCourseCredits.mockResolvedValue(null);

      const result = await controller.getCourseCredits("SF1625");

      expect(courseService.getCourseCredits).toHaveBeenCalledWith("SF1625");
      expect(result).toEqual({ credits: null });
    });
  });
});
