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
  it("rejects visitors on everything that is about a person", async () => {
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

  // The landing hero draws the real community to anybody who loads `/`, so this
  // one read has to answer without a session at all.
  it("answers the public window for a visitor", async () => {
    vi.mocked(graphService.getPublicWindow).mockResolvedValue({
      centre: { x: 0, y: 0 },
      nodes: [],
      edges: [],
    });

    await expect(caller(null).publicWindow()).resolves.toEqual({
      centre: { x: 0, y: 0 },
      nodes: [],
      edges: [],
    });
  });

  // Nothing about the caller may shape the public window: two visitors asking
  // at the same moment must be looking at the same graph.
  it("tells the public window nothing about who is asking", async () => {
    await caller({ user: { id: "user-1" } }).publicWindow();

    expect(graphService.getPublicWindow).toHaveBeenCalledWith();
  });

  it("answers for the signed-in app user, never an id from the input", async () => {
    await caller({ user: { id: "user-1" } }).neighbourhood();

    expect(graphService.getNeighbourhood).toHaveBeenCalledWith("user-1");
  });
});
