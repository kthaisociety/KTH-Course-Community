import { Test, type TestingModule } from "@nestjs/testing";
import { DRIZZLE } from "../db/drizzle.module";
import { UserService } from "./user.service";

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
  onConflictDoUpdate: jest.Mock;
  returning: jest.Mock;
};

describe("UserService", () => {
  let userService: UserService;
  let mockDb: MockDb;

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
      onConflictDoUpdate: jest.fn().mockReturnThis(),
      returning: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: DRIZZLE,
          useValue: mockDb,
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

  describe("getUserFavorites", () => {
    it("should return user favorites", async () => {
      mockDb.where.mockResolvedValue(mockUserFavorites);

      const result = await userService.getUserFavorites("user-123");

      expect(result).toEqual(["SF1625", "SF1624"]);
    });
  });

  describe("deleteUser", () => {
    it("deletes the user row and lets the cascades clear what references it", async () => {
      mockDb.where.mockResolvedValue(undefined);

      await userService.deleteUser("user-123");

      // user_favorites, reviews and review_likes declare `onDelete: "cascade"`
      // on their users.id foreign key, so one delete is enough.
      expect(mockDb.delete).toHaveBeenCalledTimes(1);
      expect(mockDb.where).toHaveBeenCalledTimes(1);
    });
  });
});

jest.mock("../db/schema", () => ({
  users: {
    id: "mocked-users-id",
    email: "mocked-users-email",
  },
  user_favorites: {
    userId: "mocked-user-favorites-userId",
  },
}));
