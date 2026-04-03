import { Test, type TestingModule } from "@nestjs/testing";
import { DRIZZLE } from "../database/drizzle.module";
import { DepartmentsService } from "./departments.service";

describe("DepartmentsService", () => {
  let service: DepartmentsService;
  let mockDb: {
    execute: jest.Mock;
  };

  beforeEach(async () => {
    mockDb = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentsService,
        {
          provide: DRIZZLE,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<DepartmentsService>(DepartmentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getDepartments", () => {
    it("should return list of departments", async () => {
      const mockDbResult = {
        rows: [
          { department: "EECS" },
          { department: "ABE" },
          { department: "ITM" },
          { department: "CBH" },
          { department: "SCI" },
        ],
      };
      mockDb.execute.mockResolvedValue(mockDbResult);

      const result = await service.getDepartments();

      expect(mockDb.execute).toHaveBeenCalledTimes(1);
      expect(result).toEqual(["EECS", "ABE", "ITM", "CBH", "SCI"]);
    });

    it("should throw error when call fails", async () => {
      const error = new Error("Database connection failed");
      mockDb.execute.mockRejectedValue(error);

      await expect(service.getDepartments()).rejects.toThrow(
        "Database connection failed",
      );
      expect(mockDb.execute).toHaveBeenCalledTimes(1);
    });
  });
});
