import { Readable } from "node:stream";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { Test, type TestingModule } from "@nestjs/testing";
import type {} from "multer";
import { PDFParse } from "pdf-parse";
import type { SessionContainer } from "supertokens-node/recipe/session";
import { UserController } from "./user.controller";
import { UserService, type UserWithDetails } from "./user.service";

jest.mock("pdf-parse", () => ({
  PDFParse: jest.fn(),
}));

type MockSession = Pick<SessionContainer, "getUserId">;

describe("UserController", () => {
  let userController: UserController;
  let userService: UserService;
  let mockSession: jest.Mocked<MockSession>;

  const mockUser: UserWithDetails = {
    id: "user-123",
    email: "Sven@kth.se",
    name: "Sven",
    profilePicture: null,
    createdAt: new Date("2023-10-15"),
    updatedAt: new Date("2023-10-15"),
    userFavorites: ["SF1625", "SF1624"],
    userReviews: [],
    userLikedReviews: [],
    transcriptCourses: [],
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
    stream: Readable.from(Buffer.from("mock file content")),
  };

  beforeEach(async () => {
    const mockUserService = {
      resolveAppUserId: jest.fn(),
      getUser: jest.fn(),
      deleteUser: jest.fn(),
    };

    mockSession = {
      getUserId: jest.fn(),
    };

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
      jest.spyOn(userService, "resolveAppUserId").mockResolvedValue("user-123");
      jest.spyOn(userService, "getUser").mockResolvedValue(mockUser);

      const result = await userController.getMe(
        mockSession as unknown as SessionContainer,
      );

      expect(userService.getUser).toHaveBeenCalledWith("user-123");
      expect(result).toEqual({
        userId: "user-123",
        name: "Sven",
        email: "Sven@kth.se",
        profilePicture: null,
        userFavorites: mockUser.userFavorites,
        userReviews: [],
        userLikedReviews: [],
        transcriptCourses: [],
      });
    });
  });

  describe("deleteAccount", () => {
    it("should delete user account successfully", async () => {
      mockSession.getUserId.mockReturnValue("user-123");
      jest.spyOn(userService, "resolveAppUserId").mockResolvedValue("user-123");
      jest.spyOn(userService, "deleteUser").mockResolvedValue(undefined);

      const result = await userController.deleteAccount(
        mockSession as unknown as SessionContainer,
      );

      expect(userService.deleteUser).toHaveBeenCalledWith("user-123");
      expect(result).toEqual({ success: true });
    });
  });

  describe("uploadTranscript", () => {
    it("releases PDF parser resources when transcript parsing fails", async () => {
      const destroy = jest
        .fn<() => Promise<void>>()
        .mockResolvedValue(undefined);

      const getText = jest
        .fn<() => Promise<{ text: string }>>()
        .mockRejectedValue(new Error("Malformed PDF"));

      jest.mocked(PDFParse).mockImplementation(
        () =>
          ({
            getText,
            destroy,
          }) as unknown as jest.Mocked<PDFParse>,
      );

      mockSession.getUserId.mockReturnValue("user-123");

      jest.spyOn(userService, "resolveAppUserId").mockResolvedValue("user-123");

      await expect(
        userController.uploadTranscript(
          mockSession as unknown as SessionContainer,
          {
            ..._mockFile,
            originalname: "transcript.pdf",
            mimetype: "application/pdf",
          },
        ),
      ).rejects.toThrow("Failed to parse PDF");

      expect(destroy).toHaveBeenCalledTimes(1);
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
