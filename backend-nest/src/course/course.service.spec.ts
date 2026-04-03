import { Test, type TestingModule } from "@nestjs/testing";
import { DRIZZLE } from "../database/drizzle.module";
import { CourseService } from "./course.service";

type CourseDbMock = {
  select: jest.Mock;
  from: jest.Mock;
  where: jest.Mock;
  limit: jest.Mock;
};

describe("CourseService", () => {
  let courseService: CourseService;
  let mockDb: CourseDbMock;

  const mockCourse = {
    code: "SF1625",
    department: "SF (SCI/Matematik) ",
    name: "Calculus in One Variable",
    state: "ESTABLISHED",
    lastExaminationSemester: null,
    updatedAt: new Date("2023-01-01"),
    credits: 7.5,
  };

  beforeEach(async () => {
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CourseService,
        {
          provide: DRIZZLE,
          useValue: mockDb,
        },
      ],
    }).compile();

    courseService = module.get<CourseService>(CourseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(courseService).toBeDefined();
  });

  describe("getCourse", () => {
    it("should return course data", async () => {
      mockDb.limit.mockResolvedValue([mockCourse]);

      const result = await courseService.getCourse("SF1625");

      expect(result).toEqual(mockCourse);
    });
  });

  describe("courseCodeExists", () => {
    it("should return true if course code exists", async () => {
      mockDb.limit.mockResolvedValue([mockCourse]);

      const result = await courseService.courseCodeExists("SF1625");

      expect(result).toBe(true);
    });

    it("should return false if course code does not exist", async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await courseService.courseCodeExists("ABCD1234");

      expect(result).toBe(false);
    });
  });

  describe("getCourseCredits", () => {
    it("should return course credits", async () => {
      mockDb.limit.mockResolvedValue([mockCourse]);
      const result = await courseService.getCourseCredits("SF1625");

      expect(result).toBe(7.5);
    });
  });
});
