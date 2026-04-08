import { Test, type TestingModule } from "@nestjs/testing";
import { CourseService } from "../course/course.service";
import { DRIZZLE } from "../database/drizzle.module";
import { UserService, type UserWithFavorites } from "./user.service";

type MockDb = {
  insert: jest.Mock;
  select: jest.Mock;
  delete: jest.Mock;
  update: jest.Mock;
  values: jest.Mock;
  set: jest.Mock;
  from: jest.Mock;
  where: jest.Mock;
  limit: jest.Mock;
  onConflictDoNothing: jest.Mock;
};

describe("UserService", () => {
  let userService: UserService;
  let mockDb: MockDb;

  const mockUser = {
    id: "user-123",
    email: "Sven@kth.se",
    name: "Sven",
    profilePicture: null,
    createdAt: new Date("2023-10-15"),
    updatedAt: new Date("2023-10-15"),
  };

  const mockUserFavorites = [
    {
      userId: "user-123",
      favoriteCourse: "SF1625",
      createdAt: new Date("2023-10-15"),
    },
    {
      userId: "user-123",
      favoriteCourse: "SF1624",
      createdAt: new Date("2023-10-15"),
    },
  ];

  beforeEach(async () => {
    mockDb = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      onConflictDoNothing: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: DRIZZLE,
          useValue: mockDb,
        },
        {
          provide: CourseService,
          useValue: { courseCodeExists: jest.fn() },
        },
      ],
    }).compile();

    userService = module.get<UserService>(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(userService).toBeDefined();
  });

  describe("createNewUser", () => {
    it("should create a new user", async () => {
      mockDb.limit.mockResolvedValue([]);
      mockDb.onConflictDoNothing.mockResolvedValue(undefined);

      await userService.createNewUser("user-123", "Sven@kth.se", "Sven");

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.limit).toHaveBeenCalledWith(1);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith({
        id: "user-123",
        email: "Sven@kth.se",
        name: "Sven",
      });
    });
  });

  describe("getUserFavorites", () => {
    it("should return user favorites", async () => {
      mockDb.where.mockResolvedValue(mockUserFavorites);

      const result = await userService.getUserFavorites("user-123");

      expect(result).toEqual(["SF1625", "SF1624"]);
    });
  });

  describe("getUser", () => {
    it("should return user with favorites", async () => {
      mockDb.limit.mockResolvedValue([mockUser]);
      jest
        .spyOn(userService, "getUserFavorites")
        .mockResolvedValue(mockUserFavorites);

      const expected: UserWithFavorites = {
        ...mockUser,
        userFavorites: mockUserFavorites,
      };

      const result = await userService.getUser("user-123");

      expect(result).toEqual(expected);
    });
  });

  describe("deleteUser", () => {
    it("should delete user and their favorites", async () => {
      mockDb.where.mockResolvedValue(undefined);

      await userService.deleteUser("user-123");

      expect(mockDb.delete).toHaveBeenCalledTimes(2);
      expect(mockDb.where).toHaveBeenCalledTimes(2);
    });
  });
});

jest.mock("../../../types/database/schema", () => ({
  users: {
    id: "mocked-users-id",
  },
  user_favorites: {
    userId: "mocked-user-favorites-userId",
  },
}));
