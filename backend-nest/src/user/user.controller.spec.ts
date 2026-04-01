import { Test, type TestingModule } from "@nestjs/testing";
import type { SessionContainer } from "supertokens-node/recipe/session";
import { UserController } from "./user.controller";
import { UserService, type UserWithFavorites } from "./user.service";

describe("UserController", () => {
  let userController: UserController;
  let userService: UserService;
  let mockSession: jest.Mocked<SessionContainer>;

  const mockUser: UserWithFavorites = {
    id: "user-123",
    email: "Sven@kth.se",
    name: "Sven",
    profilePicture: null,
    createdAt: new Date("2023-10-15"),
    updatedAt: new Date("2023-10-15"),
    userFavorites: [
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
    ],
  };

  // For testing profile image later when functionality fixed
  const _mockFile: Express.Multer.File = {
    fieldname: "file",
    originalname: "profile.jpg",
    encoding: "7bit",
    mimetype: "image/jpeg",
    size: 1024,
    buffer: Buffer.from("mock file content"),
    destination: "",
    filename: "",
    path: "",
    stream: null as any,
  };

  beforeEach(async () => {
    const mockUserService = {
      getUser: jest.fn(),
      deleteUser: jest.fn(),
    };

    mockSession = {
      getUserId: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    }).compile();

    userController = module.get<UserController>(UserController);
    userService = module.get<UserService>(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(userController).toBeDefined();
  });

  describe("getMe", () => {
    it("should return user data when user exists", async () => {
      mockSession.getUserId.mockReturnValue("user-123");
      jest.spyOn(userService, "getUser").mockResolvedValue(mockUser);

      const result = await userController.getMe(mockSession);

      expect(userService.getUser).toHaveBeenCalledWith("user-123");
      expect(result).toEqual({
        userId: "user-123",
        name: "Sven",
        email: "Sven@kth.se",
        profilePicture: null,
        userFavorites: mockUser.userFavorites,
      });
    });
  });

  describe("deleteAccount", () => {
    it("should delete user account successfully", async () => {
      mockSession.getUserId.mockReturnValue("user-123");
      jest.spyOn(userService, "deleteUser").mockResolvedValue(undefined);

      const result = await userController.deleteAccount(mockSession);

      expect(userService.deleteUser).toHaveBeenCalledWith("user-123");
      expect(result).toEqual({ success: true });
    });
  });

  // We have not implemented blob storage for images yet
  /*
  describe("uploadProfilePicture", () => {
    it("should upload profile picture and return URL", async () => {
      mockSession.getUserId.mockReturnValue("user-123");
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      const result = await userController.updateProfilePicture(
        mockSession,
        ur
      );

      expect(consoleSpy).toHaveBeenCalledWith("Uploaded file:", mockFile);
      expect(result).toEqual({
        url: "http://localhost:8080/uploads/profile.jpg",
      });

      consoleSpy.mockRestore();
    });
  });
  */
});
