import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "../errors";
import { MAX_ANCHORS, MIN_ANCHORS, NODE_COLORS } from "./placement";
import type { BackboneEdge, NeighbourNode, PlacementWrite } from "./repository";
import * as graphRepo from "./repository";
import {
  getEffectiveTier,
  getNeighbourhood,
  joinCommunityGraph,
  MAX_NEIGHBOURHOOD_NODES,
} from "./service";

vi.mock("./repository");

const JOINED = new Date("2024-01-15T12:00:00.000Z");

function neighbour(userId: string, x: number, y: number): NeighbourNode {
  return {
    userId,
    x,
    y,
    color: "aurora",
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

  it("supplies a valid node profile", async () => {
    await joinCommunityGraph("newcomer");
    const { profile } = lastPlacement();

    expect(profile.userId).toBe("newcomer");
    expect(NODE_COLORS).toContain(profile.color);
    expect(profile.style).toBe("default");
    expect(profile.signalStyle).toBe("default");
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

describe("getNeighbourhood", () => {
  const viewer = neighbour("viewer", 100, 100);

  it("bounds the node set to the neighbourhood maximum", async () => {
    vi.mocked(graphRepo.findNode).mockResolvedValue({
      userId: "viewer",
      x: 100,
      y: 100,
    });
    vi.mocked(graphRepo.findNearestNodes).mockResolvedValue([viewer]);

    await getNeighbourhood("viewer");

    expect(graphRepo.findNearestNodes).toHaveBeenCalledWith(
      { x: 100, y: 100 },
      MAX_NEIGHBOURHOOD_NODES,
    );
  });

  it("includes the viewer's own node in the set, so they can find their dot", async () => {
    vi.mocked(graphRepo.findNode).mockResolvedValue({
      userId: "viewer",
      x: 100,
      y: 100,
    });
    vi.mocked(graphRepo.findNearestNodes).mockResolvedValue([
      viewer,
      neighbour("a", 1, 1),
    ]);

    const neighbourhood = await getNeighbourhood("viewer");

    expect(neighbourhood.nodes.map((node) => node.userId)).toContain("viewer");
  });

  it("returns only the backbone edges spanning the returned set", async () => {
    const inside = [viewer, neighbour("a", 1, 1), neighbour("b", 2, 2)];
    vi.mocked(graphRepo.findNode).mockResolvedValue({
      userId: "viewer",
      x: 100,
      y: 100,
    });
    vi.mocked(graphRepo.findNearestNodes).mockResolvedValue(inside);
    vi.mocked(graphRepo.findBackboneEdgesWithin).mockResolvedValue([
      { nodeUserId: "a", anchorUserId: "b" },
      { nodeUserId: "a", anchorUserId: "far-away" },
      { nodeUserId: "far-away", anchorUserId: "viewer" },
    ]);

    const neighbourhood = await getNeighbourhood("viewer");

    expect(graphRepo.findBackboneEdgesWithin).toHaveBeenCalledWith([
      "viewer",
      "a",
      "b",
    ]);
    expect(neighbourhood.edges).toEqual([
      { nodeUserId: "a", anchorUserId: "b" },
    ]);
  });

  it("reports the viewer's effective tier alongside their own node", async () => {
    vi.mocked(graphRepo.findNode).mockResolvedValue({
      userId: "viewer",
      x: 100,
      y: 100,
    });
    vi.mocked(graphRepo.findNearestNodes).mockResolvedValue([viewer]);
    vi.mocked(graphRepo.findLastReviewAt).mockResolvedValue(
      new Date("2024-01-15T12:00:00.000Z"),
    );

    const neighbourhood = await getNeighbourhood(
      "viewer",
      new Date("2025-01-15T12:00:00.000Z"),
    );

    expect(neighbourhood.viewer).toEqual({
      userId: "viewer",
      x: 100,
      y: 100,
      effectiveTier: 1,
    });
    expect(neighbourhood.nodes).toEqual([viewer]);
  });

  it("rejects an app user who has no node yet", async () => {
    vi.mocked(graphRepo.findNode).mockResolvedValue(undefined);

    await expect(getNeighbourhood("stranger")).rejects.toBeInstanceOf(
      NotFoundError,
    );
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
