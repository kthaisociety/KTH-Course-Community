import request from "supertest";
import { DRIZZLE } from "../db/drizzle.module";
import {
  type AuthTestApp,
  createAuthTestApp,
  OTHER_SESSION_USER,
  SESSION_USER,
} from "../testing/better-auth-test-app";
import { createMockDb, type MockDb } from "../testing/mock-db";
import { ReviewsController } from "./reviews.controller";
import { ReviewsGateway } from "./reviews.gateway";
import { ReviewsService } from "./reviews.service";

const REVIEW_BODY = {
  examinationMethods: 4,
  theoreticalVsApplied: 5,
  workload: 3,
  learningExperience: 4,
  wouldRecommend: true,
  content: "Great course!",
};

const storedReview = (userId: string) => ({
  id: "review-123",
  userId,
  courseCode: "SF1625",
  ...REVIEW_BODY,
  createdAt: "2023-01-01T00:00:00.000Z",
  updatedAt: "2023-01-01T00:00:00.000Z",
});

/**
 * The reviews routes, which are where forgeable identity actually shipped.
 *
 * Every write attributes itself to the session rather than to the request
 * body, and the reads stay open to visitors.
 */
describe("ReviewsController (HTTP)", () => {
  let testApp: AuthTestApp;
  let mockDb: MockDb;
  let reviewsService: ReviewsService;

  beforeEach(async () => {
    mockDb = createMockDb();
    testApp = await createAuthTestApp({
      controllers: [ReviewsController],
      providers: [
        ReviewsService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: ReviewsGateway, useValue: { emitCourseChanged: jest.fn() } },
      ],
    });
    reviewsService = testApp.moduleRef.get(ReviewsService);
  });

  afterEach(async () => {
    await testApp.app.close();
    jest.clearAllMocks();
  });

  const http = () => request(testApp.app.getHttpServer());

  describe("POST /reviews", () => {
    it("attributes the review to the session's user", async () => {
      testApp.signInAs();
      mockDb.queueResult([storedReview(SESSION_USER.id)]);

      await http()
        .post("/reviews")
        .send({ courseCode: "SF1625", ...REVIEW_BODY })
        .expect(201, storedReview(SESSION_USER.id));

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({ userId: SESSION_USER.id }),
      );
    });

    /**
     * This is the reason the migration happened: the endpoint used to take the
     * author's id from the request body, so anybody could post as anybody.
     * Deleting this case deletes the proof that it no longer can.
     */
    it("ignores an author id supplied in the request body", async () => {
      testApp.signInAs();
      mockDb.queueResult([storedReview(SESSION_USER.id)]);

      await http()
        .post("/reviews")
        .send({
          courseCode: "SF1625",
          userId: OTHER_SESSION_USER.id,
          ...REVIEW_BODY,
        })
        .expect(201);

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({ userId: SESSION_USER.id }),
      );
      expect(mockDb.values).not.toHaveBeenCalledWith(
        expect.objectContaining({ userId: OTHER_SESSION_USER.id }),
      );
    });

    it("rejects anonymous callers", async () => {
      testApp.signOut();

      await http()
        .post("/reviews")
        .send({ courseCode: "SF1625", ...REVIEW_BODY })
        .expect(401);
    });
  });

  describe("PATCH /reviews/:id", () => {
    it("updates the caller's own review", async () => {
      testApp.signInAs();
      mockDb.queueResult([storedReview(SESSION_USER.id)]);
      mockDb.queueResult([
        { ...storedReview(SESSION_USER.id), content: "Updated content" },
      ]);

      await http()
        .patch("/reviews/review-123")
        .send({ ...REVIEW_BODY, content: "Updated content" })
        .expect(200);
    });

    it("rejects a caller who does not own the review", async () => {
      testApp.signInAs();
      mockDb.queueResult([storedReview(OTHER_SESSION_USER.id)]);

      await http()
        .patch("/reviews/review-123")
        .send({ ...REVIEW_BODY, content: "Not mine to edit" })
        .expect(403);
    });

    it("rejects anonymous callers", async () => {
      testApp.signOut();

      await http().patch("/reviews/review-123").send(REVIEW_BODY).expect(401);
    });
  });

  describe("DELETE /reviews/:id", () => {
    it("deletes the caller's own review", async () => {
      testApp.signInAs();
      mockDb.queueResult([storedReview(SESSION_USER.id)]);
      mockDb.queueResult([storedReview(SESSION_USER.id)]);

      await http().delete("/reviews/review-123").expect(200);
    });

    it("rejects a caller who does not own the review", async () => {
      testApp.signInAs();
      mockDb.queueResult([storedReview(OTHER_SESSION_USER.id)]);

      await http().delete("/reviews/review-123").expect(403);
    });

    it("rejects anonymous callers", async () => {
      testApp.signOut();

      await http().delete("/reviews/review-123").expect(401);
    });
  });

  describe("POST /reviews/:id/like", () => {
    it("attributes the vote to the session's user, not to the body", async () => {
      testApp.signInAs();
      mockDb.queueResult([]);
      mockDb.queueResult([{ courseCode: "SF1625" }]);

      await http()
        .post("/reviews/review-123/like")
        .send({ userId: OTHER_SESSION_USER.id })
        .expect(201);

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: SESSION_USER.id,
          reviewId: "review-123",
          voteType: "like",
        }),
      );
      expect(mockDb.values).not.toHaveBeenCalledWith(
        expect.objectContaining({ userId: OTHER_SESSION_USER.id }),
      );
    });

    it("rejects anonymous callers", async () => {
      testApp.signOut();

      await http()
        .post("/reviews/review-123/like")
        .send({ userId: SESSION_USER.id })
        .expect(401);
    });
  });

  describe("GET /reviews", () => {
    it("is readable by visitors, with no viewer vote state", async () => {
      testApp.signOut();
      // The viewer identity never reaches the response body, so the argument
      // the listing resolves its viewer from is the contract being asserted.
      const findAll = jest.spyOn(reviewsService, "findAll");
      mockDb.queueResult([storedReview(SESSION_USER.id)]);

      await http().get("/reviews?courseCode=SF1625").expect(200);

      expect(findAll).toHaveBeenCalledWith("SF1625", undefined);
    });

    it("resolves the viewer from the session", async () => {
      testApp.signInAs();
      const findAll = jest.spyOn(reviewsService, "findAll");
      mockDb.queueResult([storedReview(SESSION_USER.id)]);

      await http().get("/reviews?courseCode=SF1625").expect(200);

      expect(findAll).toHaveBeenCalledWith("SF1625", SESSION_USER.id);
    });

    /**
     * A viewer id in the query string used to decide whose voting history was
     * attached to the response, so any caller could read back anybody's votes.
     */
    it("ignores a viewer id supplied in the query string", async () => {
      testApp.signInAs();
      const findAll = jest.spyOn(reviewsService, "findAll");
      mockDb.queueResult([storedReview(SESSION_USER.id)]);

      await http()
        .get(`/reviews?courseCode=SF1625&userId=${OTHER_SESSION_USER.id}`)
        .expect(200);

      expect(findAll).toHaveBeenCalledWith("SF1625", SESSION_USER.id);
    });

    it("ignores a viewer id supplied by a visitor", async () => {
      testApp.signOut();
      const findAll = jest.spyOn(reviewsService, "findAll");
      mockDb.queueResult([storedReview(SESSION_USER.id)]);

      await http()
        .get(`/reviews?courseCode=SF1625&userId=${OTHER_SESSION_USER.id}`)
        .expect(200);

      expect(findAll).toHaveBeenCalledWith("SF1625", undefined);
    });
  });

  describe("GET /reviews/:id", () => {
    it("is readable by visitors", async () => {
      testApp.signOut();
      mockDb.queueResult([storedReview(SESSION_USER.id)]);

      await http()
        .get("/reviews/review-123")
        .expect(200, storedReview(SESSION_USER.id));
    });
  });
});
