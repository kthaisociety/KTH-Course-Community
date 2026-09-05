import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, NotFoundError } from "../errors";
import { UNCONFIGURED_APPEARANCE } from "./appearance";
import {
  DEFAULT_NODE_COLOR,
  MAX_ANCHORS,
  MIN_ANCHORS,
  NODE_COLORS,
} from "./placement";
import type { BackboneEdge, NeighbourNode, PlacementWrite } from "./repository";
import * as graphRepo from "./repository";
import {
  backfillEarnedPersonalizationTiers,
  COMMUNITY_ORIGIN,
  getNeighbourhood,
  getNodePersonalization,
  getPersonalizationTiers,
  getPublicWindow,
  joinCommunityGraph,
  joinCommunityGraphOnSignUp,
  MAX_NEIGHBOURHOOD_NODES,
  MAX_PUBLIC_WINDOW_NODES,
  recordEarnedPersonalizationTier,
  recordEarnedPersonalizationTierOnContribution,
  setNodeAppearance,
} from "./service";

vi.mock("./repository");

const JOINED = new Date("2024-01-15T12:00:00.000Z");

function neighbour(
  userId: string,
  x: number,
  y: number,
  appearance: Partial<
    Pick<NeighbourNode, "color" | "style" | "signalStyle">
  > = {},
): NeighbourNode {
  return {
    userId,
    x,
    y,
    color: DEFAULT_NODE_COLOR,
    style: "default",
    signalStyle: "default",
    ...appearance,
  };
}

/**
 * A tier basis for every node in a window, all at the same pair of numbers.
 *
 * `lastReviewAt` defaults to the moment the window is read, so nothing has
 * decayed unless a test says so. That keeps "what does this node draw with" a
 * question about the numbers rather than about the clock.
 */
function tierBases(
  nodes: NeighbourNode[],
  earnedTier: number,
  lastReviewAt: Date | null = new Date(),
) {
  return nodes.map((node) => ({
    userId: node.userId,
    earnedTier,
    accountCreatedAt: JOINED,
    lastReviewAt,
  }));
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
  vi.mocked(graphRepo.findNodeTierBases).mockResolvedValue([]);
  vi.mocked(graphRepo.findNodeProfile).mockResolvedValue(undefined);
  vi.mocked(graphRepo.upsertNodeProfile).mockImplementation(
    async (_userId, choice) => ({ ...UNCONFIGURED_APPEARANCE, ...choice }),
  );
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

  /**
   * The landing reads this on every visit, so it must not carry work the page
   * does not need. It answers with a window and nothing else: the viewer's own
   * tier numbers live on `graph.personalization`, which is what My Page asks,
   * and returning them here cost two queries for numbers nothing on the landing
   * looks at.
   *
   * The per-node tier bases are a different thing and are read. They are what
   * masks a dormant axis back to unconfigured, they are one query for the whole
   * window rather than two per node, and no number out of them reaches the
   * response.
   */
  it("returns a window and nothing else, and never reads the viewer's own tier", async () => {
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
    expect(graphRepo.findNodeTierBases).toHaveBeenCalledTimes(1);
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
        "signalStyle",
        "style",
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

describe("getPersonalizationTiers", () => {
  it("decays from the app user's most recent review", async () => {
    vi.mocked(graphRepo.findTierBasis).mockResolvedValue({
      earnedTier: 3,
      accountCreatedAt: new Date("2020-01-01T00:00:00.000Z"),
    });
    vi.mocked(graphRepo.findLastReviewAt).mockResolvedValue(JOINED);

    const tiers = await getPersonalizationTiers(
      "reviewer",
      new Date("2025-01-15T12:00:00.000Z"),
    );

    expect(tiers.effectiveTier).toBe(1);
  });

  /**
   * The earned number is what tells a dormant axis from a locked one, so it has
   * to come back undecayed beside the other. This is the whole reason the read
   * answers with two numbers rather than one.
   */
  it("reports the earned tier untouched beside the decayed one", async () => {
    vi.mocked(graphRepo.findTierBasis).mockResolvedValue({
      earnedTier: 3,
      accountCreatedAt: new Date("2020-01-01T00:00:00.000Z"),
    });
    vi.mocked(graphRepo.findLastReviewAt).mockResolvedValue(JOINED);

    expect(
      await getPersonalizationTiers(
        "reviewer",
        new Date("2044-01-15T12:00:00.000Z"),
      ),
    ).toEqual({ earnedTier: 3, effectiveTier: 0 });
  });

  it("decays from the account creation date when the app user has never reviewed", async () => {
    vi.mocked(graphRepo.findTierBasis).mockResolvedValue({
      earnedTier: 2,
      accountCreatedAt: JOINED,
    });
    vi.mocked(graphRepo.findLastReviewAt).mockResolvedValue(null);

    const at = async (iso: string) =>
      (await getPersonalizationTiers("quiet", new Date(iso))).effectiveTier;

    expect(await at("2024-07-14T12:00:00.000Z")).toBe(2);
    expect(await at("2024-07-15T12:00:00.000Z")).toBe(1);
  });

  it("rejects an unknown app user", async () => {
    vi.mocked(graphRepo.findTierBasis).mockResolvedValue(undefined);

    await expect(getPersonalizationTiers("ghost")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("never writes the earned tier back", async () => {
    await getPersonalizationTiers(
      "reader",
      new Date("2044-01-01T00:00:00.000Z"),
    );

    // Decay is derived and thrown away. The graph domain owns exactly two
    // writes — placement, and the monotonic tier raise — and reading a decayed
    // tier must touch neither. The name list is the guard against a third
    // appearing quietly.
    expect(graphRepo.persistPlacement).not.toHaveBeenCalled();
    expect(graphRepo.raiseEarnedTier).not.toHaveBeenCalled();
    expect(
      Object.keys(graphRepo).filter((name) =>
        /^(insert|update|upsert|delete|save|persist|set|raise)/.test(name),
      ),
    ).toEqual(["persistPlacement", "raiseEarnedTier", "upsertNodeProfile"]);
    expect(graphRepo.upsertNodeProfile).not.toHaveBeenCalled();
  });
});

describe("recordEarnedPersonalizationTier", () => {
  beforeEach(() => {
    vi.mocked(graphRepo.findReviewedCourses).mockResolvedValue([]);
    vi.mocked(graphRepo.findTranscriptImportedCourses).mockResolvedValue([]);
    vi.mocked(graphRepo.raiseEarnedTier).mockResolvedValue(true);
  });

  it("raises the column to what the contributions earn", async () => {
    vi.mocked(graphRepo.findReviewedCourses).mockResolvedValue([
      { courseCode: "SF1625", userId: "u1" },
    ]);
    vi.mocked(graphRepo.findTranscriptImportedCourses).mockResolvedValue([
      { courseCode: "SF1625" },
    ]);

    expect(await recordEarnedPersonalizationTier("u1")).toEqual({
      earned: 3,
      raised: true,
    });
    expect(graphRepo.raiseEarnedTier).toHaveBeenCalledWith("u1", 3);
  });

  it("counts only transcript-imported courses towards tier 2", async () => {
    // A manually typed course never reaches the service: the repository read
    // filters on `transcript_imported_at`, so an app user with none is at the
    // tier their reviews alone earn.
    vi.mocked(graphRepo.findReviewedCourses).mockResolvedValue([
      { courseCode: "SF1625", userId: "u1" },
    ]);

    expect(await recordEarnedPersonalizationTier("u1")).toEqual({
      earned: 1,
      raised: true,
    });
    expect(graphRepo.raiseEarnedTier).toHaveBeenCalledWith("u1", 1);
  });

  it("writes nothing for an app user who has earned nothing", async () => {
    expect(await recordEarnedPersonalizationTier("u1")).toEqual({
      earned: 0,
      raised: false,
    });
    expect(graphRepo.raiseEarnedTier).not.toHaveBeenCalled();
  });

  /**
   * The monotonicity itself is `greatest` in SQL, which is the only place it
   * can be true under concurrency. What the service must not do is talk itself
   * out of it: a recompute that answers 2 for somebody the column already has
   * at 3 still asks for 2, and the repository declines. Never a demotion, and
   * never a read-then-write that could race one in.
   */
  it("asks for the recomputed tier and lets the repository refuse to lower it", async () => {
    vi.mocked(graphRepo.findReviewedCourses).mockResolvedValue([
      { courseCode: "SF1625", userId: "u1" },
    ]);
    vi.mocked(graphRepo.findTranscriptImportedCourses).mockResolvedValue([
      { courseCode: "SF1625" },
      { courseCode: "DD1337" },
    ]);
    vi.mocked(graphRepo.raiseEarnedTier).mockResolvedValue(false);

    expect(await recordEarnedPersonalizationTier("u1")).toEqual({
      earned: 2,
      raised: false,
    });
    expect(graphRepo.raiseEarnedTier).toHaveBeenCalledWith("u1", 2);
    expect(graphRepo.findTierBasis).not.toHaveBeenCalled();
  });

  it("swallows its own failure so a contribution is never lost to it", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(graphRepo.findReviewedCourses).mockRejectedValue(
      new Error("neon is having a day"),
    );

    await expect(
      recordEarnedPersonalizationTierOnContribution("u1"),
    ).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalled();

    logged.mockRestore();
  });
});

/**
 * The writer only fires on a new contribution, so everybody who reviewed or
 * imported before it shipped needs one pass to be given what they had already
 * earned. These cover the properties that make that pass safe to run at all:
 * it visits each contributor once, it pages until the pages run out, and a
 * second run changes nothing.
 */
describe("backfillEarnedPersonalizationTiers", () => {
  beforeEach(() => {
    vi.mocked(graphRepo.findReviewedCourses).mockResolvedValue([]);
    vi.mocked(graphRepo.findTranscriptImportedCourses).mockResolvedValue([]);
    vi.mocked(graphRepo.raiseEarnedTier).mockResolvedValue(true);
  });

  /** Candidates served a page at a time, the way the repository serves them. */
  function candidates(userIds: string[], pageSize: number) {
    vi.mocked(graphRepo.findTierCandidateUserIds).mockImplementation(
      async (after, limit) => {
        const start = after === null ? 0 : userIds.indexOf(after) + 1;
        return userIds.slice(start, start + Math.min(limit, pageSize));
      },
    );
  }

  it("recomputes every contributor, following the cursor across pages", async () => {
    const userIds = ["u1", "u2", "u3", "u4", "u5"];
    candidates(userIds, 2);
    vi.mocked(graphRepo.findReviewedCourses).mockImplementation(
      async (userId) => [{ courseCode: "SF1625", userId }],
    );

    const result = await backfillEarnedPersonalizationTiers(2);

    expect(result).toEqual({ scanned: 5, raised: 5 });
    for (const userId of userIds) {
      expect(graphRepo.raiseEarnedTier).toHaveBeenCalledWith(userId, 1);
    }
    // Each app user exactly once: paging on the id, never on an offset.
    expect(vi.mocked(graphRepo.raiseEarnedTier).mock.calls.length).toBe(5);
  });

  it("does nothing when nobody has contributed", async () => {
    candidates([], 200);

    expect(await backfillEarnedPersonalizationTiers()).toEqual({
      scanned: 0,
      raised: 0,
    });
    expect(graphRepo.raiseEarnedTier).not.toHaveBeenCalled();
  });

  it("reports no raises on a second run, because the write only ever raises", async () => {
    candidates(["u1", "u2"], 200);
    vi.mocked(graphRepo.findReviewedCourses).mockImplementation(
      async (userId) => [{ courseCode: "SF1625", userId }],
    );
    // The repository declines a raise that would not move the column.
    vi.mocked(graphRepo.raiseEarnedTier).mockResolvedValue(false);

    expect(await backfillEarnedPersonalizationTiers()).toEqual({
      scanned: 2,
      raised: 0,
    });
  });

  it("stops rather than reporting a half-finished run", async () => {
    candidates(["u1", "u2"], 200);
    vi.mocked(graphRepo.findReviewedCourses).mockRejectedValue(
      new Error("neon is having a day"),
    );

    await expect(backfillEarnedPersonalizationTiers()).rejects.toThrow(
      "neon is having a day",
    );
  });
});

describe("a window's node appearance", () => {
  const PICKED = { color: "ember", style: "diamond", signalStyle: "comet" };
  const nodes = [neighbour("them", 10, 10, PICKED)];

  beforeEach(() => {
    vi.mocked(graphRepo.findNearestNodes).mockResolvedValue(nodes);
  });

  it("draws what a member with the tier for it has chosen", async () => {
    vi.mocked(graphRepo.findNodeTierBases).mockResolvedValue(
      tierBases(nodes, 3),
    );

    const [node] = (await getPublicWindow()).nodes;

    expect(node).toMatchObject(PICKED);
  });

  /**
   * "Go quiet for a while and it settles back to default" — My Page's own copy
   * about the network, so decay has to reach the canvas and not only the tab.
   * A member at earned 3 who has not reviewed for eighteen months is at
   * effective 0, and every axis renders unconfigured.
   */
  it("settles a decayed member's node back to the default it started as", async () => {
    vi.mocked(graphRepo.findNodeTierBases).mockResolvedValue(
      tierBases(nodes, 3, new Date("2020-01-01T00:00:00.000Z")),
    );

    const [node] = (await getPublicWindow()).nodes;

    expect(node).toMatchObject(UNCONFIGURED_APPEARANCE);
  });

  // Decay costs one tier per six months, so it uncovers the axes one at a time,
  // from the top. The colour a member earned first is the last thing to go.
  it("masks only the axes the effective tier no longer reaches", async () => {
    vi.mocked(graphRepo.findNodeTierBases).mockResolvedValue([
      {
        userId: "them",
        earnedTier: 3,
        accountCreatedAt: JOINED,
        // Seven months without a review: one decay step, so tier 3 is dormant.
        lastReviewAt: new Date("2024-01-15T12:00:00.000Z"),
      },
    ]);
    vi.mocked(graphRepo.findNearestNodes).mockResolvedValue(nodes);

    vi.setSystemTime(new Date("2024-08-16T12:00:00.000Z"));
    try {
      const [node] = (await getPublicWindow()).nodes;

      expect(node).toMatchObject({
        color: "ember",
        style: "diamond",
        signalStyle: "default",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  /**
   * Masking is a read-time derivation and this is the assertion that keeps it
   * one. Nothing about drawing a decayed node may reach a column: the pick has
   * to be there, intact, when the member reviews again.
   */
  it("writes nothing at all while masking", async () => {
    vi.mocked(graphRepo.findNodeTierBases).mockResolvedValue(
      tierBases(nodes, 3, new Date("2020-01-01T00:00:00.000Z")),
    );

    await getPublicWindow();

    expect(graphRepo.upsertNodeProfile).not.toHaveBeenCalled();
    expect(graphRepo.persistPlacement).not.toHaveBeenCalled();
    expect(graphRepo.raiseEarnedTier).not.toHaveBeenCalled();
  });

  // An account removed between the two reads. Unconfigured is the conservative
  // answer and the same one the column defaults give, so it is not a special
  // case; drawing the stored pick on no evidence would be.
  it("draws a node whose tier basis did not come back as unconfigured", async () => {
    vi.mocked(graphRepo.findNodeTierBases).mockResolvedValue([]);

    const [node] = (await getPublicWindow()).nodes;

    expect(node).toMatchObject(UNCONFIGURED_APPEARANCE);
  });

  // The public window is unauthenticated. Appearance is drawn on the landing by
  // design; a tier number is not, and neither is anybody's id.
  it("still carries no user id and no tier number", async () => {
    vi.mocked(graphRepo.findNodeTierBases).mockResolvedValue(
      tierBases(nodes, 3),
    );

    const payload = JSON.stringify(await getPublicWindow());

    expect(payload).not.toContain("them");
    expect(payload).not.toContain("Tier");
    expect(payload).not.toContain("tier");
  });
});

describe("getNodePersonalization", () => {
  it("reports both tier numbers and the stored appearance", async () => {
    vi.mocked(graphRepo.findTierBasis).mockResolvedValue({
      earnedTier: 2,
      accountCreatedAt: JOINED,
    });
    vi.mocked(graphRepo.findLastReviewAt).mockResolvedValue(JOINED);
    vi.mocked(graphRepo.findNodeProfile).mockResolvedValue({
      color: "moss",
      style: "ring",
      signalStyle: "default",
    });

    expect(await getNodePersonalization("u1", JOINED)).toEqual({
      earnedTier: 2,
      effectiveTier: 2,
      appearance: { color: "moss", style: "ring", signalStyle: "default" },
    });
  });

  /**
   * The tab shows the pick a dormant axis is holding, unmasked. Hiding it would
   * make "reviewing again restores them" unverifiable from the one screen that
   * says so — the member would have only our word that anything is waiting.
   */
  it("shows a dormant axis's pick rather than the default the canvas draws", async () => {
    vi.mocked(graphRepo.findTierBasis).mockResolvedValue({
      earnedTier: 3,
      accountCreatedAt: JOINED,
    });
    vi.mocked(graphRepo.findLastReviewAt).mockResolvedValue(JOINED);
    vi.mocked(graphRepo.findNodeProfile).mockResolvedValue({
      color: "violet",
      style: "diamond",
      signalStyle: "comet",
    });

    const state = await getNodePersonalization(
      "quiet",
      new Date("2044-01-01T00:00:00.000Z"),
    );

    expect(state.effectiveTier).toBe(0);
    expect(state.earnedTier).toBe(3);
    expect(state.appearance).toEqual({
      color: "violet",
      style: "diamond",
      signalStyle: "comet",
    });
  });

  // Placement writes a profile row, but accounts predating the community graph
  // never saw it. No row is unconfigured, which is what the defaults would say.
  it("reads a missing profile row as unconfigured", async () => {
    vi.mocked(graphRepo.findNodeProfile).mockResolvedValue(undefined);

    expect((await getNodePersonalization("u1")).appearance).toEqual(
      UNCONFIGURED_APPEARANCE,
    );
  });

  it("rejects an unknown app user", async () => {
    vi.mocked(graphRepo.findTierBasis).mockResolvedValue(undefined);

    await expect(getNodePersonalization("ghost")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("setNodeAppearance", () => {
  /** An app user whose effective tier is exactly `tier`, with no decay. */
  function at(tier: number) {
    vi.mocked(graphRepo.findTierBasis).mockResolvedValue({
      earnedTier: tier,
      accountCreatedAt: JOINED,
    });
    vi.mocked(graphRepo.findLastReviewAt).mockResolvedValue(new Date());
  }

  it("writes an axis the app user's effective tier unlocks", async () => {
    at(1);

    const state = await setNodeAppearance("u1", { color: "frost" });

    expect(graphRepo.upsertNodeProfile).toHaveBeenCalledWith("u1", {
      color: "frost",
    });
    expect(state.appearance.color).toBe("frost");
  });

  /**
   * The gate, one rung at a time. A member at tier 1 may choose a colour and
   * nothing else; the picker disables the rest, but the picker is presentation
   * and this is the check that actually decides.
   */
  it("refuses every axis above the effective tier", async () => {
    at(1);

    await expect(
      setNodeAppearance("u1", { style: "ring" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      setNodeAppearance("u1", { signalStyle: "comet" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(graphRepo.upsertNodeProfile).not.toHaveBeenCalled();
  });

  it("refuses the whole write when one axis of several is out of reach", async () => {
    at(2);

    await expect(
      setNodeAppearance("u1", { color: "ember", signalStyle: "dashed" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    // Not a partial write: the colour it *could* have taken is not stored either.
    expect(graphRepo.upsertNodeProfile).not.toHaveBeenCalled();
  });

  it("accepts every axis at the top of the ladder", async () => {
    at(3);

    await setNodeAppearance("u1", {
      color: "aurora",
      style: "diamond",
      signalStyle: "fade",
    });

    expect(graphRepo.upsertNodeProfile).toHaveBeenCalledWith("u1", {
      color: "aurora",
      style: "diamond",
      signalStyle: "fade",
    });
  });

  /**
   * **The gate is the effective tier, not the earned one.** A member who
   * reached tier 3 and went quiet cannot set a tier-3 axis today — and their
   * stored pick is untouched by the refusal, which is the difference between
   * dormant and lost.
   */
  it("refuses a dormant axis, and does not disturb what it holds", async () => {
    vi.mocked(graphRepo.findTierBasis).mockResolvedValue({
      earnedTier: 3,
      accountCreatedAt: JOINED,
    });
    vi.mocked(graphRepo.findLastReviewAt).mockResolvedValue(JOINED);

    await expect(
      setNodeAppearance(
        "quiet",
        { signalStyle: "comet" },
        new Date("2044-01-01T00:00:00.000Z"),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(graphRepo.upsertNodeProfile).not.toHaveBeenCalled();
  });

  // Un-picking is a choice like any other and goes through the same gate: a
  // member at tier 0 may not clear a colour any more than they may set one.
  it("treats a return to the default as a write on that axis", async () => {
    at(1);
    await setNodeAppearance("u1", { color: "default" });
    expect(graphRepo.upsertNodeProfile).toHaveBeenCalledWith("u1", {
      color: "default",
    });

    at(0);
    await expect(
      setNodeAppearance("u1", { color: "default" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  // Only the axis that was named. An axis left out keeps whatever it held,
  // which is what lets a dormant pick survive an edit to a different one.
  it("sends the repository only the axes it was asked for", async () => {
    at(3);

    await setNodeAppearance("u1", { style: "ring" });

    expect(graphRepo.upsertNodeProfile).toHaveBeenCalledWith("u1", {
      style: "ring",
    });
  });

  it("answers with the current state for a choice that names nothing", async () => {
    at(3);
    vi.mocked(graphRepo.findNodeProfile).mockResolvedValue({
      color: "slate",
      style: "default",
      signalStyle: "default",
    });

    const state = await setNodeAppearance("u1", {});

    expect(graphRepo.upsertNodeProfile).not.toHaveBeenCalled();
    expect(state.appearance.color).toBe("slate");
  });

  it("rejects an unknown app user before it writes anything", async () => {
    vi.mocked(graphRepo.findTierBasis).mockResolvedValue(undefined);

    await expect(
      setNodeAppearance("ghost", { color: "ember" }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(graphRepo.upsertNodeProfile).not.toHaveBeenCalled();
  });

  // Choosing a colour must not touch the tier. The earned column has exactly one
  // writer and personalisation is not it.
  it("never raises the earned tier as a side effect of a choice", async () => {
    at(3);

    await setNodeAppearance("u1", { color: "ember" });

    expect(graphRepo.raiseEarnedTier).not.toHaveBeenCalled();
  });
});
