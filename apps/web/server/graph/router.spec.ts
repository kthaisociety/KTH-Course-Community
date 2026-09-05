import { beforeEach, describe, expect, it, vi } from "vitest";
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

// The service is auto-mocked once for the file, so call history has to be
// cleared between tests or an assertion that a procedure wrote *nothing* sees
// the previous test's write. Implementations are kept.
beforeEach(() => {
  vi.clearAllMocks();
});

describe("graph router", () => {
  it("rejects visitors on everything that is about a person", async () => {
    const visitor = caller(null);

    await expect(visitor.join()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(visitor.neighbourhood()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(visitor.personalization()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      visitor.setAppearance({ color: "ember" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
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

describe("graph router: choosing a node's appearance", () => {
  const STATE = {
    earnedTier: 3,
    effectiveTier: 3,
    appearance: {
      color: "ember" as const,
      style: "default" as const,
      signalStyle: "default" as const,
    },
  };

  it("writes for the signed-in app user, never an id from the input", async () => {
    vi.mocked(graphService.setNodeAppearance).mockResolvedValue(STATE);

    await caller({ user: { id: "user-1" } }).setAppearance({ color: "ember" });

    expect(graphService.setNodeAppearance).toHaveBeenCalledWith("user-1", {
      color: "ember",
    });
  });

  it("passes only the axes the caller named", async () => {
    vi.mocked(graphService.setNodeAppearance).mockResolvedValue(STATE);

    await caller({ user: { id: "user-1" } }).setAppearance({ style: "ring" });

    expect(graphService.setNodeAppearance).toHaveBeenCalledWith("user-1", {
      style: "ring",
    });
  });

  /**
   * The schema bounds the vocabulary and nothing else. It is not the gate —
   * whether this caller may set this axis is a question about their effective
   * tier and is answered in the service — but a name outside the enum should
   * never reach it, because the database would refuse it as a type error rather
   * than as a rule.
   */
  it("refuses a name that is not on the axis", async () => {
    const member = caller({ user: { id: "user-1" } });

    await expect(
      member.setAppearance({ color: "chartreuse" } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      member.setAppearance({ style: "hexagon" } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      member.setAppearance({ signalStyle: "ripple" } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(graphService.setNodeAppearance).not.toHaveBeenCalled();
  });

  // A field nobody declared is a caller trying something. It is refused rather
  // than dropped, so the attempt is visible instead of silently ignored.
  it("refuses a field the axes do not have", async () => {
    await expect(
      caller({ user: { id: "user-1" } }).setAppearance({
        userId: "somebody-else",
      } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  // Un-picking is a real choice and has to be spellable.
  it("accepts a return to the unconfigured default on every axis", async () => {
    vi.mocked(graphService.setNodeAppearance).mockResolvedValue(STATE);

    await caller({ user: { id: "user-1" } }).setAppearance({
      color: "default",
      style: "default",
      signalStyle: "default",
    });

    expect(graphService.setNodeAppearance).toHaveBeenCalledWith("user-1", {
      color: "default",
      style: "default",
      signalStyle: "default",
    });
  });

  it("reads the caller's own personalization and nobody else's", async () => {
    vi.mocked(graphService.getNodePersonalization).mockResolvedValue(STATE);

    await expect(
      caller({ user: { id: "user-1" } }).personalization(),
    ).resolves.toEqual(STATE);
    expect(graphService.getNodePersonalization).toHaveBeenCalledWith("user-1");
  });
});
