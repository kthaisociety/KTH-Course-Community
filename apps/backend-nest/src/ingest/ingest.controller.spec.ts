import request from "supertest";
import {
  type AuthTestApp,
  createAuthTestApp,
} from "../testing/better-auth-test-app";
import { IngestController } from "./ingest.controller";
import { IngestService } from "./ingest.service";

const SECRET = "test-ingest-secret";

/**
 * The ingest routes, which reach Kopps, Neon and Elasticsearch and so belong to
 * scheduled jobs rather than to people.
 *
 * `@AllowAnonymous()` takes these routes out from under Better Auth's global
 * guard, so `IngestKeyGuard` is the only thing left standing between them and
 * the internet. These specs pin that down through real HTTP: the guard, the
 * decorators and the routing all run, and the service underneath is a mock so
 * that a leak shows up as a call that should never have happened.
 */
describe("IngestController (HTTP)", () => {
  let testApp: AuthTestApp;
  let mockIngest: {
    runFullIngest: jest.Mock;
    runNeonIngest: jest.Mock;
    runElasticIngest: jest.Mock;
    getIngestStatus: jest.Mock;
    runNeonTest: jest.Mock;
    runElasticTest: jest.Mock;
  };
  let originalSecret: string | undefined;

  beforeAll(() => {
    originalSecret = process.env.INGEST_SECRET;
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.INGEST_SECRET;
    else process.env.INGEST_SECRET = originalSecret;
  });

  beforeEach(async () => {
    process.env.INGEST_SECRET = SECRET;
    mockIngest = {
      runFullIngest: jest.fn().mockResolvedValue(undefined),
      runNeonIngest: jest.fn().mockResolvedValue(undefined),
      runElasticIngest: jest.fn().mockResolvedValue(undefined),
      getIngestStatus: jest.fn().mockReturnValue({
        neon: { running: false },
        elastic: { running: false },
      }),
      runNeonTest: jest.fn().mockResolvedValue(undefined),
      runElasticTest: jest.fn().mockResolvedValue(undefined),
    };

    testApp = await createAuthTestApp({
      controllers: [IngestController],
      providers: [{ provide: IngestService, useValue: mockIngest }],
    });
  });

  afterEach(async () => {
    await testApp.app.close();
    jest.clearAllMocks();
  });

  const http = () => request(testApp.app.getHttpServer());

  /** Every route the controller exposes, so none can be added unprotected. */
  const routes = [
    ["post", "/ingest/courses", 202] as const,
    ["post", "/ingest/courses/neon", 202] as const,
    ["post", "/ingest/courses/elastic", 202] as const,
    ["get", "/ingest/status", 200] as const,
    ["post", "/ingest/test-neon", 200] as const,
    ["post", "/ingest/test-elastic", 200] as const,
  ];

  describe("without a valid secret", () => {
    it.each(routes)("rejects %s %s with no header", async (method, path) => {
      await http()[method](path).expect(401);
    });

    it.each(routes)(
      "rejects %s %s with a wrong secret",
      async (method, path) => {
        await http()[method](path).set("x-ingest-key", "wrong").expect(401);
      },
    );

    it("rejects a secret that is a prefix of the real one", async () => {
      await http()
        .post("/ingest/courses")
        .set("x-ingest-key", SECRET.slice(0, -1))
        .expect(401);
    });

    it("rejects a signed-in user who has no secret", async () => {
      // The point of the guard: a Google session is not authorisation here.
      testApp.signInAs();

      await http().post("/ingest/courses").expect(401);
    });

    it("runs no ingestion for any rejected request", async () => {
      testApp.signInAs();

      await http().post("/ingest/courses").expect(401);
      await http().post("/ingest/courses/neon").set("x-ingest-key", "wrong");
      await http().post("/ingest/test-neon");

      expect(mockIngest.runFullIngest).not.toHaveBeenCalled();
      expect(mockIngest.runNeonIngest).not.toHaveBeenCalled();
      expect(mockIngest.runNeonTest).not.toHaveBeenCalled();
    });
  });

  describe("when INGEST_SECRET is unset", () => {
    // Fails closed: a box that never got the variable must lock the door, not
    // remove it. `undefined === undefined` would open it.
    beforeEach(() => {
      delete process.env.INGEST_SECRET;
    });

    it("rejects a request carrying no header", async () => {
      await http().post("/ingest/courses").expect(401);
    });

    it("rejects a request carrying an empty header", async () => {
      await http().post("/ingest/courses").set("x-ingest-key", "").expect(401);
    });

    it("runs no ingestion", async () => {
      await http().post("/ingest/courses").set("x-ingest-key", "anything");

      expect(mockIngest.runFullIngest).not.toHaveBeenCalled();
    });
  });

  describe("with the correct secret", () => {
    it.each(routes)(
      "allows %s %s anonymously",
      async (method, path, status) => {
        await http()[method](path).set("x-ingest-key", SECRET).expect(status);
      },
    );

    it("queues the full ingest", async () => {
      await http()
        .post("/ingest/courses")
        .set("x-ingest-key", SECRET)
        .expect(202, { status: "queued (in-process)", task: "courses" });

      expect(mockIngest.runFullIngest).toHaveBeenCalledTimes(1);
    });

    it("queues the Neon-only ingest", async () => {
      await http()
        .post("/ingest/courses/neon")
        .set("x-ingest-key", SECRET)
        .expect(202, { status: "queued (in-process)", task: "courses/neon" });

      expect(mockIngest.runNeonIngest).toHaveBeenCalledTimes(1);
      expect(mockIngest.runElasticIngest).not.toHaveBeenCalled();
    });

    it("queues the Elastic-only ingest", async () => {
      await http()
        .post("/ingest/courses/elastic")
        .set("x-ingest-key", SECRET)
        .expect(202, {
          status: "queued (in-process)",
          task: "courses/elastic",
        });

      expect(mockIngest.runElasticIngest).toHaveBeenCalledTimes(1);
      expect(mockIngest.runNeonIngest).not.toHaveBeenCalled();
    });

    it("returns the pipeline status", async () => {
      await http()
        .get("/ingest/status")
        .set("x-ingest-key", SECRET)
        .expect(200, { neon: { running: false }, elastic: { running: false } });
    });

    it("runs the Neon and Elastic test ingests", async () => {
      await http()
        .post("/ingest/test-neon")
        .set("x-ingest-key", SECRET)
        .expect(200, { status: "ok", task: "test-neon" });
      await http()
        .post("/ingest/test-elastic")
        .set("x-ingest-key", SECRET)
        .expect(200, { status: "queued", task: "test-elastic" });

      expect(mockIngest.runNeonTest).toHaveBeenCalledTimes(1);
      expect(mockIngest.runElasticTest).toHaveBeenCalledTimes(1);
    });
  });
});
