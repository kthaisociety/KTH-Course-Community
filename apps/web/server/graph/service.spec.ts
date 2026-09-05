import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "../errors";
import {
  DEFAULT_NODE_COLOR,
  MAX_ANCHORS,
  MIN_ANCHORS,
  NODE_COLORS,
} from "./placement";
import type { BackboneEdge, NeighbourNode, PlacementWrite } from "./repository";
import * as graphRepo from "./repository";
import {
  COMMUNITY_ORIGIN,
  getEffectiveTier,
  getNeighbourhood,
  getPublicWindow,
  joinCommunityGraph,
  joinCommunityGraphOnSignUp,
  MAX_NEIGHBOURHOOD_NODES,
  MAX_PUBLIC_WINDOW_NODES,
} from "./service";

vi.mock("./repository");

const JOINED = new Date("2024-01-15T12:00:00.000Z");

function neighbour(userId: string, x: number, y: number): NeighbourNode {
  return {
    userId,
    x,
    y,
    color: DEFAULT_NODE_COLOR,
    style: "default",
    signalStyle: "default",
  };
}

/** An established community of `size` nodes on a coarse grid. */
function community(size: number): NeighbourNode[] {
  return Array.from({ length: size }, (_, i) =>
    neighbour(`established-${i}`, i * 37, i * -19),
  );
}

function lastPlacement(): PlacementWrite {
  const call = vi.mocked(graphRepo.persistPlacement).mock.calls.at(-1);
  if (!call) throw new Error("persistPlacement was never called");
  return call[0];
}

/**
 * A stateful stand-in for the graph repository: an in-memory community that
 * remembers what placement wrote, so a test can join several app users in a
 * row and inspect what happened to the ones already there.
 */
function inMemoryCommunity() {
  const nodes: NeighbourNode[] = [];
  const edges: BackboneEdge[] = [];

  vi.mocked(graphRepo.countNodes).mockImplementation(async () => nodes.length);
  vi.mocked(graphRepo.findNode).mockImplementation(async (userId) => {
    const found = nodes.find((node) => node.userId === userId);
    return found && { userId: found.userId, x: found.x, y: found.y };
  });
  vi.mocked(graphRepo.findNearestNodes).mockImplementation(
    async (origin, limit, excludeUserId) =>
      nodes
        .filter((node) => node.userId !== excludeUserId)
        .sort(
          (a, b) =>
            Math.hypot(a.x - origin.x, a.y - origin.y) -
            Math.hypot(b.x - origin.x, b.y - origin.y),
        )
        .slice(0, limit),
  );
  vi.mocked(graphRepo.persistPlacement).mockImplementation(async (write) => {
    if (nodes.some((node) => node.userId === write.node.userId))
      return undefined;
    nodes.push({ ...write.node, ...write.profile });
    edges.push(...write.edges);
    return write.node;
  });

  return { nodes, edges };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(graphRepo.countNodes).mockResolvedValue(0);
  vi.mocked(graphRepo.findNode).mockResolvedValue(undefined);
  vi.mocked(graphRepo.findNearestNodes).mockResolvedValue([]);
  vi.mocked(graphRepo.findBackboneEdgesWithin).mockResolvedValue([]);
  vi.mocked(graphRepo.persistPlacement).mockImplementation(
    async (write) => write.node,
  );
  vi.mocked(graphRepo.findTierBasis).mockResolvedValue({
    earnedTier: 3,
    accountCreatedAt: JOINED,
  });
  vi.mocked(graphRepo.findLastReviewAt).mockResolvedValue(null);
});

describe("joinCommunityGraph", () => {
  it("persists a world position for the joining app user", async () => {
    vi.mocked(graphRepo.countNodes).mockResolvedValue(20);
    vi.mocked(graphRepo.findNearestNodes).mockResolvedValue(community(20));

    const node = await joinCommunityGraph("newcomer");

    expect(node.userId).toBe("newcomer");
    expect(Number.isFinite(node.x)).toBe(true);
    expect(Number.isFinite(node.y)).toBe(true);
    expect(lastPlacement().node).toEqual(node);
  });

  it("attaches the new node to three to five anchors", async () => {
    vi.mocked(graphRepo.countNodes).mockResolvedValue(20);
    vi.mocked(graphRepo.findNearestNodes).mockResolvedValue(community(20));

    await joinCommunityGraph("newcomer");
    const { edges } = lastPlacement();

    expect(edges.length).toBeGreaterThanOrEqual(MIN_ANCHORS);
    expect(edges.length).toBeLessThanOrEqual(MAX_ANCHORS);
  });

  it("points every backbone edge from the new node at an older anchor", async () => {
    vi.mocked(graphRepo.countNodes).mockResolvedValue(20);
    vi.mocked(graphRepo.findNearestNodes).mockResolvedValue(community(20));

    await joinCommunityGraph("newcomer");
    const { edges } = lastPlacement();

    expect(edges.every((edge) => edge.nodeUserId === "newcomer")).toBe(true);
    expect(new Set(edges.map((edge) => edge.anchorUserId)).size).toBe(
      edges.length,
    );
  });

  it("never writes a self-edge, even if the joining node is offered as a candidate", async () => {
    vi.mocked(graphRepo.countNodes).mockResolvedValue(4);
    vi.mocked(graphRepo.findNearestNodes).mockResolvedValue([
      neighbour("newcomer", 0, 0),
      ...community(3),
    ]);

    await joinCommunityGraph("newcomer");
    const { edges } = lastPlacement();

    expect(edges.some((edge) => edge.anchorUserId === "newcomer")).toBe(false);
  });

  it("takes every established node when the community is smaller than the anchor count", async () => {
    vi.mocked(graphRepo.countNodes).mockResolvedValue(2);
    vi.mocked(graphRepo.findNearestNodes).mockResolvedValue(community(2));

    await joinCommunityGraph("newcomer");

    expect(lastPlacement().edges).toHaveLength(2);
  });

  it("places the very first app user with no anchors at all", async () => {
    await joinCommunityGraph("first");

    expect(lastPlacement().edges).toEqual([]);
  });

  // Placement used to hash the app user onto one of the six palette names, so
  // everybody ended up with a colour nobody chose while the colour axis was
  // locked for all of them. It stores the column default instead.
  it("gives the new node the unconfigured appearance, choosing nothing for anybody", async () => {
    await joinCommunityGraph("newcomer");
    const { profile } = lastPlacement();

    expect(profile.userId).toBe("newcomer");
    expect(profile.color).toBe(DEFAULT_NODE_COLOR);
    expect(NODE_COLORS).not.toContain(profile.color as never);
    expect(profile.style).toBe("default");
    expect(profile.signalStyle).toBe("default");
  });

  it("never hands out a palette colour, however many app users join", async () => {
    inMemoryCommunity();
    for (let i = 0; i < 40; i++) await joinCommunityGraph(`member-${i}`);

    const colours = vi
      .mocked(graphRepo.persistPlacement)
      .mock.calls.map(([write]) => write.profile.color);

    expect(new Set(colours)).toEqual(new Set([DEFAULT_NODE_COLOR]));
  });

  it("leaves an already-placed app user exactly where they are", async () => {
    vi.mocked(graphRepo.findNode).mockResolvedValue({
      userId: "returning",
      x: 12.5,
      y: -8.25,
    });

    const node = await joinCommunityGraph("returning");

    expect(node).toEqual({ userId: "returning", x: 12.5, y: -8.25 });
    expect(graphRepo.persistPlacement).not.toHaveBeenCalled();
  });

  it("yields to a concurrent join that was persisted first", async () => {
    const winner = { userId: "newcomer", x: 42, y: -17 };
    vi.mocked(graphRepo.findNode)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(winner);
    vi.mocked(graphRepo.persistPlacement).mockResolvedValue(undefined);

    const node = await joinCommunityGraph("newcomer");

    // The losing request reports where the app user really is, never the
    // position it computed and failed to store.
    expect(node).toEqual(winner);
  });

  it("refuses to invent a position when a conflicted placement leaves no node", async () => {
    vi.mocked(graphRepo.persistPlacement).mockResolvedValue(undefined);

    await expect(joinCommunityGraph("newcomer")).rejects.toThrow(
      /conflicted but no node was found/,
    );
  });

  it("does not move anyone already placed when the community grows", async () => {
    const { nodes } = inMemoryCommunity();
    const seen: Record<string, { x: number; y: number }> = {};

    for (let i = 0; i < 12; i++) {
      await joinCommunityGraph(`member-${i}`);

      for (const node of nodes) {
        const before = seen[node.userId];
        if (before) {
          expect({ x: node.x, y: node.y }).toEqual(before);
        }
        seen[node.userId] = { x: node.x, y: node.y };
      }
    }

    expect(nodes).toHaveLength(12);
  });
});

describe("joinCommunityGraphOnSignUp", () => {
  it("gives the new account a node", async () => {
    const { nodes } = inMemoryCommunity();
    for (const established of community(6)) {
      await joinCommunityGraph(established.userId);
    }

    await joinCommunityGraphOnSignUp("newcomer");

    expect(nodes.map((node) => node.userId)).toContain("newcomer");
  });

  it("swallows a placement failure, so it can never fail sign-up", async () => {
    const failure = new Error("graph unreachable");
    vi.mocked(graphRepo.findNode).mockRejectedValue(failure);
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      joinCommunityGraphOnSignUp("newcomer"),
    ).resolves.toBeUndefined();

    expect(logged).toHaveBeenCalledWith(expect.any(String), failure);
    logged.mockRestore();
  });
});

describe("getNeighbourhood", () => {
  const viewer = neighbour("viewer", 100, 100);

  function placedViewer() {
    vi.mocked(graphRepo.findNode).mockResolvedValue({
      userId: "viewer",
      x: 100,
      y: 100,
    });
  }

  it("bounds the node set to the neighbourhood maximum", async () => {
    placedViewer();
    vi.mocked(graphRepo.findNearestNodes).mockResolvedValue([viewer]);

    await getNeighbourhood("viewer");

    expect(graphRepo.findNearestNodes).toHaveBeenCalledWith(
      { x: 100, y: 100 },
      MAX_NEIGHBOURHOOD_NODES,
    );
  });

  it("centres the window on the viewer's own world position", async () => {
    placedViewer();
    vi.mocked(graphRepo.findNearestNodes).mockResolvedValue([viewer]);

    expect((await getNeighbourhood("viewer")).centre).toEqual({
      x: 100,
      y: 100,
    });
  });

  it("includes the viewer's own node, flagged, so they can find their dot", async () => {
    placedViewer();
    vi.mocked(graphRepo.findNearestNodes).mockResolvedValue([
      viewer,
      neighbour("a", 1, 1),
    ]);

    const { nodes } = await getNeighbourhood("viewer");

    expect(nodes.filter((node) => node.isViewer)).toHaveLength(1);
    expect(nodes.find((node) => node.isViewer)).toMatchObject({
      x: 100,
      y: 100,
    });
  });

  it("returns only the backbone edges spanning the returned set", async () => {
    const inside = [viewer, neighbour("a", 1, 1), neighbour("b", 2, 2)];
    placedViewer();
    vi.mocked(graphRepo.findNearestNodes).mockResolvedValue(inside);
    vi.mocked(graphRepo.findBackboneEdgesWithin).mockResolvedValue([
      { nodeUserId: "a", anchorUserId: "b" },
      { nodeUserId: "a", anchorUserId: "far-away" },
      { nodeUserId: "far-away", anchorUserId: "viewer" },
    ]);

    const { nodes, edges } = await getNeighbourhood("viewer");

    expect(graphRepo.findBackboneEdgesWithin).toHaveBeenCalledWith([
      "viewer",
      "a",
      "b",
    ]);
    const byId = new Map(nodes.map((node) => [node.id, node]));
    expect(edges).toHaveLength(1);
    expect(byId.get(edges[0].fromId)).toMatchObject({ x: 1, y: 1 });
    expect(byId.get(edges[0].toId)).toMatchObject({ x: 2, y: 2 });
  });

  // The landing reads this on every visit now, so it must not carry work the
  // page does not need. The tier lives on `graph.effectiveTier`, which is what
  // My Page asks, and reading it here cost two queries for a number nothing on
  // the landing looks at.
  it("returns a window and nothing else, reading no tier", async () => {
    placedViewer();
    vi.mocked(graphRepo.findNearestNodes).mockResolvedValue([viewer]);

    const neighbourhood = await getNeighbourhood("viewer");

    expect(Object.keys(neighbourhood).sort()).toEqual([
      "centre",
      "edges",
      "nodes",
    ]);
    expect(graphRepo.findTierBasis).not.toHaveBeenCalled();
    expect(graphRepo.findLastReviewAt).not.toHaveBeenCalled();
  });

  it("places an app user who has no node yet, rather than turning them away", async () => {
    const { nodes } = inMemoryCommunity();
    for (const established of community(6)) {
      await joinCommunityGraph(established.userId);
    }

    const neighbourhood = await getNeighbourhood("latecomer");

    expect(neighbourhood.nodes.some((node) => node.isViewer)).toBe(true);
    expect(nodes.map((node) => node.userId)).toContain("latecomer");
  });

  // The read is authenticated, but naming a member's neighbours to them is
  // still naming them, and nothing on the client needs an id it did not
  // generate itself.
  it("names nobody, not even the viewer", async () => {
    placedViewer();
    vi.mocked(graphRepo.findNearestNodes).mockResolvedValue([
      viewer,
      neighbour("a", 1, 1),
    ]);
    vi.mocked(graphRepo.findBackboneEdgesWithin).mockResolvedValue([
      { nodeUserId: "a", anchorUserId: "viewer" },
    ]);

    const payload = JSON.stringify(await getNeighbourhood("viewer"));

    expect(payload).not.toContain("viewer");
    expect(payload).not.toContain("userId");
  });
});

describe("getPublicWindow", () => {
  const around = [
    neighbour("first", 0, 0),
    neighbour("second", 120, 0),
    neighbour("third", -60, 90),
  ];

  it("centres on the community origin, never on the caller", async () => {
    vi.mocked(graphRepo.findNearestNodes).mockResolvedValue(around);

    const window = await getPublicWindow();

    expect(graphRepo.findNearestNodes).toHaveBeenCalledWith(
      COMMUNITY_ORIGIN,
      MAX_PUBLIC_WINDOW_NODES,
    );
    expect(window.centre).toEqual({ x: 0, y: 0 });
  });

  it("has no You in it", async () => {
    vi.mocked(graphRepo.findNearestNodes).mockResolvedValue(around);

    const window = await getPublicWindow();

    expect(window.nodes.every((node) => node.isViewer === false)).toBe(true);
  });

  /**
   * The procedure is unauthenticated, so this payload is readable by anybody
   * with the URL. A user id in it would hand a stranger the membership list —
   * and, joined against a review byline, a name for a dot.
   */
  it("returns no user id, anywhere, in any form", async () => {
    vi.mocked(graphRepo.findNearestNodes).mockResolvedValue(around);
    vi.mocked(graphRepo.findBackboneEdgesWithin).mockResolvedValue([
      { nodeUserId: "second", anchorUserId: "first" },
      { nodeUserId: "third", anchorUserId: "first" },
    ]);

    const window = await getPublicWindow();
    const payload = JSON.stringify(window);

    for (const node of around) {
      expect(payload).not.toContain(node.userId);
    }
    expect(payload).not.toContain("userId");
    expect(payload).not.toContain("nodeUserId");
    expect(payload).not.toContain("anchorUserId");
    for (const node of window.nodes) {
      expect(Object.keys(node).sort()).toEqual([
        "color",
        "id",
        "isViewer",
        "x",
        "y",
      ]);
    }
  });

  it("gives every node a distinct token, and reuses none of them next time", async () => {
    vi.mocked(graphRepo.findNearestNodes).mockResolvedValue(around);

    const first = await getPublicWindow();
    const second = await getPublicWindow();
    const firstIds = first.nodes.map((node) => node.id);

    expect(new Set(firstIds).size).toBe(around.length);
    for (const id of second.nodes.map((node) => node.id)) {
      expect(firstIds).not.toContain(id);
    }
  });

  it("joins its edges to its own nodes and to nothing else", async () => {
    vi.mocked(graphRepo.findNearestNodes).mockResolvedValue(around);
    vi.mocked(graphRepo.findBackboneEdgesWithin).mockResolvedValue([
      { nodeUserId: "second", anchorUserId: "first" },
      // A backbone edge reaching outside the bounded set.
      { nodeUserId: "third", anchorUserId: "somebody-far-away" },
    ]);

    const window = await getPublicWindow();
    const ids = new Set(window.nodes.map((node) => node.id));

    expect(window.edges).toHaveLength(1);
    for (const edge of window.edges) {
      expect(ids.has(edge.fromId)).toBe(true);
      expect(ids.has(edge.toId)).toBe(true);
    }
  });

  // The real community is small and the hero is allowed to be sparse. What it
  // must never do is invent somebody to fill the frame.
  it("returns an empty window rather than inventing a community", async () => {
    vi.mocked(graphRepo.findNearestNodes).mockResolvedValue([]);

    expect(await getPublicWindow()).toEqual({
      centre: COMMUNITY_ORIGIN,
      nodes: [],
      edges: [],
    });
  });

  it("writes nothing — a visitor's read may not place anybody", async () => {
    vi.mocked(graphRepo.findNearestNodes).mockResolvedValue(around);

    await getPublicWindow();

    expect(graphRepo.persistPlacement).not.toHaveBeenCalled();
  });
});

describe("getEffectiveTier", () => {
  it("decays from the app user's most recent review", async () => {
    vi.mocked(graphRepo.findTierBasis).mockResolvedValue({
      earnedTier: 3,
      accountCreatedAt: new Date("2020-01-01T00:00:00.000Z"),
    });
    vi.mocked(graphRepo.findLastReviewAt).mockResolvedValue(JOINED);

    const tier = await getEffectiveTier(
      "reviewer",
      new Date("2025-01-15T12:00:00.000Z"),
    );

    expect(tier).toBe(1);
  });

  it("decays from the account creation date when the app user has never reviewed", async () => {
    vi.mocked(graphRepo.findTierBasis).mockResolvedValue({
      earnedTier: 2,
      accountCreatedAt: JOINED,
    });
    vi.mocked(graphRepo.findLastReviewAt).mockResolvedValue(null);

    expect(
      await getEffectiveTier("quiet", new Date("2024-07-14T12:00:00.000Z")),
    ).toBe(2);
    expect(
      await getEffectiveTier("quiet", new Date("2024-07-15T12:00:00.000Z")),
    ).toBe(1);
  });

  it("rejects an unknown app user", async () => {
    vi.mocked(graphRepo.findTierBasis).mockResolvedValue(undefined);

    await expect(getEffectiveTier("ghost")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("never writes the earned tier back", async () => {
    await getEffectiveTier("reader", new Date("2044-01-01T00:00:00.000Z"));

    // The only write the graph domain owns is placement; there is deliberately
    // no repository function that could update personalization_tier_earned.
    expect(graphRepo.persistPlacement).not.toHaveBeenCalled();
    expect(
      Object.keys(graphRepo).filter((name) =>
        /^(insert|update|upsert|delete|save|persist|set)/.test(name),
      ),
    ).toEqual(["persistPlacement"]);
  });
});
