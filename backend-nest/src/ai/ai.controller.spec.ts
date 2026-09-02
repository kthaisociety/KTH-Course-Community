import request from "supertest";
import {
  type AuthTestApp,
  createAuthTestApp,
} from "../testing/better-auth-test-app";
import { AiController } from "./ai.controller";

jest.mock("ai", () => {
  const actual = jest.requireActual("ai");
  return {
    ...actual,
    // The endpoint spends AI gateway credits, so the stream is stubbed; what
    // matters here is only who is allowed to reach it.
    pipeAgentUIStreamToResponse: jest.fn(
      async ({ response }: { response: { json: (body: unknown) => void } }) => {
        response.json({ streamed: true });
      },
    ),
  };
});

/**
 * The AI chat endpoint requires a session.
 *
 * It sits on a public URL and spends AI gateway credits per call, so an
 * anonymous caller must not reach the agent at all.
 */
describe("AiController (HTTP)", () => {
  let testApp: AuthTestApp;

  beforeEach(async () => {
    testApp = await createAuthTestApp({ controllers: [AiController] });
  });

  afterEach(async () => {
    await testApp.app.close();
    jest.clearAllMocks();
  });

  const http = () => request(testApp.app.getHttpServer());

  it("rejects anonymous callers", async () => {
    testApp.signOut();

    await http().post("/ai/chat").send({ messages: [] }).expect(401);
  });

  it("serves a signed-in caller", async () => {
    testApp.signInAs();

    await http()
      .post("/ai/chat")
      .send({ messages: [] })
      .expect(200, { streamed: true });
  });
});
