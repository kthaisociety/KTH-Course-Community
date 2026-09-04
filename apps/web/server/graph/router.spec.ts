import { describe, expect, it, vi } from "vitest";
import { createCallerFactory } from "../api/trpc";
import { graphRouter } from "./router";
import * as graphService from "./service";

vi.mock("./service");

function caller(session: { user: { id: string } } | null) {
  return createCallerFactory(graphRouter)({
    session: session as never,
    headers: new Headers(),
  });
}

describe("graph router", () => {
  it("rejects visitors on every procedure", async () => {
    const visitor = caller(null);

    await expect(visitor.join()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(visitor.neighbourhood()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(visitor.effectiveTier()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("answers for the signed-in app user, never an id from the input", async () => {
    await caller({ user: { id: "user-1" } }).neighbourhood();

    expect(graphService.getNeighbourhood).toHaveBeenCalledWith("user-1");
  });
});
