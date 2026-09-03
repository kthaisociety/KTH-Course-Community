import { NotFoundError } from "../errors";
import {
  chooseAnchorCount,
  computeWorldPosition,
  DEFAULT_NODE_SIGNAL_STYLE,
  DEFAULT_NODE_STYLE,
  pickNodeColor,
} from "./placement";
import type { BackboneEdge, GraphNode, NeighbourNode } from "./repository";
import * as graphRepo from "./repository";
import { deriveEffectiveTier } from "./tier";

/**
 * How many nodes one bounded neighbourhood read may return.
 *
 * This is a query policy, not a database column: the landing page never loads
 * the whole community, and the bound belongs to the domain that answers the
 * question.
 */
export const MAX_NEIGHBOURHOOD_NODES = 150;

/** A bounded slice of the community graph around one app user. */
export type Neighbourhood = {
  viewer: GraphNode & { effectiveTier: number };
  nodes: NeighbourNode[];
  edges: BackboneEdge[];
};

/**
 * Give an app user their place in the community graph.
 *
 * Idempotent: an app user who already has a node keeps it, untouched. A new
 * node is placed at the outer edge of the community and attached to three to
 * five established anchors — nobody already placed is asked to move, and no
 * global layout pass ever runs.
 */
export async function joinCommunityGraph(userId: string): Promise<GraphNode> {
  const existing = await graphRepo.findNode(userId);
  if (existing) return existing;

  const position = computeWorldPosition(userId, await graphRepo.countNodes());
  const node: GraphNode = { userId, ...position };
  const anchors = await findAnchors(userId, position);

  await graphRepo.persistPlacement({
    node,
    profile: {
      userId,
      color: pickNodeColor(userId),
      style: DEFAULT_NODE_STYLE,
      signalStyle: DEFAULT_NODE_SIGNAL_STYLE,
    },
    // Direction records placement history: the newer node points at the older
    // anchor. A backbone edge is not a friendship and carries no social meaning.
    edges: anchors.map((anchor) => ({
      nodeUserId: userId,
      anchorUserId: anchor.userId,
    })),
  });

  return node;
}

/**
 * The bounded neighbourhood around an app user's own node: the nearby nodes,
 * the backbone edges spanning exactly that set, and the app user's effective
 * personalization tier.
 *
 * World units come back untouched. Projecting them into screen pixels, and any
 * responsive keep-out adjustment, happens on the client and never returns here.
 */
export async function getNeighbourhood(
  userId: string,
  now: Date = new Date(),
): Promise<Neighbourhood> {
  const node = await graphRepo.findNode(userId);
  if (!node) {
    throw new NotFoundError(`No community graph node for app user ${userId}`);
  }

  const nodes = await graphRepo.findNearestNodes(
    { x: node.x, y: node.y },
    MAX_NEIGHBOURHOOD_NODES,
  );
  const withinSet = new Set(nodes.map((neighbour) => neighbour.userId));
  const edges = await graphRepo.findBackboneEdgesWithin([...withinSet]);

  return {
    viewer: { ...node, effectiveTier: await getEffectiveTier(userId, now) },
    nodes,
    // The query already scopes to this set. Narrowing here too keeps the
    // guarantee true of the service whatever that query later becomes.
    edges: edges.filter(
      (edge) =>
        withinSet.has(edge.nodeUserId) && withinSet.has(edge.anchorUserId),
    ),
  };
}

/**
 * The personalization tier an app user effectively has right now.
 *
 * Read-only by construction: the earned tier is the highest ever reached and
 * decay is derived from it, never written back.
 */
export async function getEffectiveTier(
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  const basis = await graphRepo.findTierBasis(userId);
  if (!basis) throw new NotFoundError(`No such app user: ${userId}`);

  const lastReviewAt = await graphRepo.findLastReviewAt(userId);
  // An app user who has never reviewed decays from when they joined, so a
  // brand-new account is not instantly decayed.
  return deriveEffectiveTier(
    basis.earnedTier,
    lastReviewAt ?? basis.accountCreatedAt,
    now,
  );
}

/**
 * The established nodes a joining node attaches to: the ones nearest its new
 * world position. One extra candidate is requested so that a row for the
 * joining app user, if the community ever contains one, can be dropped without
 * costing an anchor. Self-edges are impossible here and rejected by the
 * `no_self_backbone_edge` check constraint besides.
 */
async function findAnchors(
  userId: string,
  position: { x: number; y: number },
): Promise<NeighbourNode[]> {
  const anchorCount = chooseAnchorCount(userId);
  const candidates = await graphRepo.findNearestNodes(
    position,
    anchorCount + 1,
    userId,
  );
  return candidates
    .filter((candidate) => candidate.userId !== userId)
    .slice(0, anchorCount);
}
