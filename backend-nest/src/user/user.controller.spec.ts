import request from "supertest";
import { DRIZZLE } from "../db/drizzle.module";
import {
  type AuthTestApp,
  createAuthTestApp,
  SESSION_USER,
} from "../testing/better-auth-test-app";
import { createMockDb, type MockDb } from "../testing/mock-db";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";

jest.mock("@vercel/blob", () => ({
  put: jest.fn().mockResolvedValue({
    url: "https://blob.example.com/profile-abc123.jpg",
  }),
}));

const { put } = jest.requireMock("@vercel/blob") as { put: jest.Mock };

/**
 * The user routes under the Better Auth session shape.
 *
 * There is one id now: the id on the session's user is the app user id, so the
 * controller reaches the database with it directly. Nothing resolves one id
 * into another, and no route is reachable without a session.
 */
describe("UserController (HTTP)", () => {
  let testApp: AuthTestApp;
  let mockDb: MockDb;

  beforeEach(async () => {
    mockDb = createMockDb();
    testApp = await createAuthTestApp({
      controllers: [UserController],
      providers: [UserService, { provide: DRIZZLE, useValue: mockDb }],
    });
  });

  afterEach(async () => {
    await testApp.app.close();
    jest.clearAllMocks();
  });

  const http = () => request(testApp.app.getHttpServer());

  describe("GET /user/me", () => {
    it("returns the signed-in user's profile", async () => {
      testApp.signInAs();
      mockDb.queueResult([
        {
          id: SESSION_USER.id,
          name: SESSION_USER.name,
          email: SESSION_USER.email,
          image: null,
        },
      ]);
      mockDb.queueResult([
        { favoriteCourse: "SF1625" },
        { favoriteCourse: "SF1624" },
      ]);

      const response = await http().get("/user/me").expect(200);

      expect(response.body).toEqual({
        userId: SESSION_USER.id,
        name: SESSION_USER.name,
        email: SESSION_USER.email,
        userFavorites: ["SF1625", "SF1624"],
        image: null,
      });
    });

    it("reports 404 when the session's user has no row", async () => {
      testApp.signInAs();
      mockDb.queueResult([]);

      await http().get("/user/me").expect(404);
    });

    it("rejects anonymous callers", async () => {
      testApp.signOut();

      await http().get("/user/me").expect(401);
    });
  });

  describe("GET /user/favorites", () => {
    it("returns the signed-in user's favourite course codes", async () => {
      testApp.signInAs();
      mockDb.queueResult([
        { favoriteCourse: "SF1625" },
        { favoriteCourse: "SF1624" },
      ]);

      await http().get("/user/favorites").expect(200, ["SF1625", "SF1624"]);
    });

    it("rejects anonymous callers", async () => {
      testApp.signOut();

      await http().get("/user/favorites").expect(401);
    });
  });

  describe("POST /user/toggle-favorite", () => {
    it("adds a course that is not yet a favourite", async () => {
      testApp.signInAs();
      mockDb.queueResult([]);

      await http()
        .post("/user/toggle-favorite")
        .send({ courseCode: "SF1625" })
        .expect(201, { success: true, action: "added" });

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: SESSION_USER.id,
          favoriteCourse: "SF1625",
        }),
      );
    });

    it("removes a course that is already a favourite", async () => {
      testApp.signInAs();
      mockDb.queueResult([
        { userId: SESSION_USER.id, favoriteCourse: "SF1625" },
      ]);

      await http()
        .post("/user/toggle-favorite")
        .send({ courseCode: "SF1625" })
        .expect(201, { success: true, action: "removed" });
    });

    it("rejects anonymous callers", async () => {
      testApp.signOut();

      await http()
        .post("/user/toggle-favorite")
        .send({ courseCode: "SF1625" })
        .expect(401);
    });
  });

  describe("POST /user/profile-picture", () => {
    it("stores the uploaded picture and returns its URL", async () => {
      testApp.signInAs();

      await http()
        .post("/user/profile-picture")
        .attach("file", Buffer.from("a picture"), "profile.jpg")
        .expect(201, { url: "https://blob.example.com/profile-abc123.jpg" });

      expect(put).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          image: "https://blob.example.com/profile-abc123.jpg",
        }),
      );
    });

    it("rejects a request with no file", async () => {
      testApp.signInAs();

      await http().post("/user/profile-picture").expect(400);
    });

    it("rejects anonymous callers", async () => {
      testApp.signOut();

      await http()
        .post("/user/profile-picture")
        .attach("file", Buffer.from("a picture"), "profile.jpg")
        .expect(401);
    });
  });

  describe("DELETE /user", () => {
    it("deletes the signed-in user's account", async () => {
      testApp.signInAs();

      await http().delete("/user").expect(200, { success: true });

      expect(mockDb.delete).toHaveBeenCalled();
    });

    it("rejects anonymous callers", async () => {
      testApp.signOut();

      await http().delete("/user").expect(401);
    });
  });
});
