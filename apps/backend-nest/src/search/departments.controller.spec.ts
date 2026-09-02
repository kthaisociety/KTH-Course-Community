import { Test, type TestingModule } from "@nestjs/testing";
import { DepartmentsController } from "./departments.controller";
import { DepartmentsService } from "./departments.service";

describe("DepartmentsController", () => {
  let controller: DepartmentsController;
  let departmentsService: DepartmentsService;

  const mockDepartmentsService = {
    getDepartments: jest
      .fn()
      .mockResolvedValue(["EECS", "ABE", "ITM", "CBH", "SCI"]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DepartmentsController],
      providers: [
        {
          provide: DepartmentsService,
          useValue: mockDepartmentsService,
        },
      ],
    }).compile();

    controller = module.get<DepartmentsController>(DepartmentsController);
    departmentsService = module.get<DepartmentsService>(DepartmentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
    expect(departmentsService).toBeDefined();
  });

  describe("getAll", () => {
    it("should return departments with count and list", async () => {
      const mockDepartments = ["EECS", "ABE", "ITM", "CBH", "SCI"];
      mockDepartmentsService.getDepartments.mockResolvedValue(mockDepartments);

      const result = await controller.getAll();

      expect(departmentsService.getDepartments).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        departmentCount: 5,
        departments: mockDepartments,
      });
    });

    it("should handle service errors", async () => {
      const error = new Error("Database connection failed");
      mockDepartmentsService.getDepartments.mockRejectedValue(error);

      await expect(controller.getAll()).rejects.toThrow(
        "Database connection failed",
      );
      expect(departmentsService.getDepartments).toHaveBeenCalledTimes(1);
    });
  });
});
