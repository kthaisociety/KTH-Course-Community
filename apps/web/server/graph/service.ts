import { NotFoundError } from "../errors";
import {
  chooseAnchorCount,
  computeWorldPosition,
  DEFAULT_NODE_COLOR,
  DEFAULT_NODE_SIGNAL_STYLE,
  DEFAULT_NODE_STYLE,
  type WorldPosition,
} from "./placement";
import type { BackboneEdge, GraphNode, NeighbourNode } from "./repository";
import * as graphRepo from "./repository";
import { deriveEarnedTier, deriveEffectiveTier } from "./tier";

/**
 * How many nodes one bounded neighbourhood read may return.
 *
 * This is a query policy, not a database column: the landing page never loads
 * the whole community, and the bound belongs to the domain that answers the
 * question.
 */
export const MAX_NEIGHBOURHOOD_NODES = 150;

/**
 * How many nodes the public window may return.
 *
 * Deliberately its own number rather than a reuse of the one above. The
 * neighbourhood is a read a member makes about themselves; this one is served
 * to anybody who loads `/`, so it must be possible to tighten it — for cost, or
 * because the community has grown enough that a stranger seeing 150 nodes at
 * once starts to say something — without changing what a member sees.
 */
export const MAX_PUBLIC_WINDOW_NODES = 150;

/**
 * Where the community's world coordinate system begins, and what the public
 * window is centred on. `computeWorldPosition` puts the very first node exactly
 * here and grows the radius from it, so the origin is the densest part of the
 * graph and the honest place to point a camera that has no viewer to follow.
 */
export const COMMUNITY_ORIGIN: WorldPosition = { x: 0, y: 0 };

/**
 * One node inside a bounded window, carrying nothing that outlives the response.
 *
 * `id` is **opaque and generated per request**. It exists only so this
 * response's edges can name this response's nodes; it is not a user id, it is
 * not stable between two reads, and there is nothing to look it up in. The
 * public window is unauthenticated, so a real user id in this payload would
 * hand a stranger the community's membership list — and the member read has no
 * business naming somebody's neighbours to them either.
 */
export type WindowNode = {
  id: string;
  x: number;
  y: number;
  /**
   * The stored appearance name. Node appearance is drawn on a public landing
   * page by design, so it is not a disclosure; it is also `"default"` for
   * everybody until a member has some way to choose a colour. The earned tier
   * has a writer now, but nothing writes `users_node_profiles.color`.
   */
  color: string;
  /** The one node belonging to the caller. Never true in a public window. */
  isViewer: boolean;
};

/**
 * A backbone edge between two nodes of the same window.
 *
 * Its stored direction records placement history — newer node to older anchor —
 * and it **is not a friendship**. The names here say so: `fromId`/`toId`, not
 * anything that reads as one person choosing another.
 */
export type WindowEdge = { fromId: string; toId: string };

/** A bounded slice of the community graph, ready to project. */
export type GraphWindow = {
  /**
   * The world position the client's projection subtracts: the viewer's own node
   * for a member, the community origin for a visitor. World units, untouched.
   */
  centre: WorldPosition;
  nodes: WindowNode[];
  edges: WindowEdge[];
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

  const placed = await graphRepo.persistPlacement({
    node,
    profile: {
      userId,
      // Nobody has chosen a colour, so nobody is given one. Placement stores the
      // column default and the client draws that in the brand blue.
      color: DEFAULT_NODE_COLOR,
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
  if (placed) return placed;

  // A concurrent join for the same app user committed first. Their placement
  // stands and ours was abandoned whole, so report where this app user really
  // is rather than coordinates that were never stored.
  const winner = await graphRepo.findNode(userId);
  if (!winner) {
    throw new Error(
      `Placement for app user ${userId} conflicted but no node was found`,
    );
  }
  return winner;
}

/**
 * Place a freshly created account in the community graph.
 *
 * Sign-up is the wrong moment to be strict: a member who cannot sign in
 * because the graph is unavailable has lost their account, while a member
 * without a node has lost nothing they can see yet — `getNeighbourhood` places
 * them on their first read. So a failure here is logged and swallowed.
 */
export async function joinCommunityGraphOnSignUp(
  userId: string,
): Promise<void> {
  try {
    await joinCommunityGraph(userId);
  } catch (error) {
    console.error(
      `Could not place app user ${userId} in the community graph at sign-up:`,
      error,
    );
  }
}

/**
 * The bounded neighbourhood around an app user's own node: the nearby nodes and
 * the backbone edges spanning exactly that set.
 *
 * `nodes` deliberately contains the viewer's own node, flagged `isViewer` — it
 * is the one they came to find, and it needs the same appearance every other
 * node has. `centre` repeats its world position because the client's projection
 * is expressed relative to it, so nothing has to search the set for itself.
 *
 * World units come back untouched. Projecting them into screen pixels, and any
 * responsive keep-out adjustment, happens on the client and never returns here.
 *
 * An app user without a node is placed rather than refused, so this read can
 * write on its first call for them.
 *
 * It returns a window and nothing else. It used to carry the effective
 * personalization tier as well, from a time when it was read only if somebody
 * opened **Find your dot**; the landing draws the graph on load now, so that
 * would be two extra queries on every visit for a number this page does not
 * use. `graph.effectiveTier` is where My Page asks for it.
 */
export async function getNeighbourhood(userId: string): Promise<GraphWindow> {
  // Sign-up placement is the primary pathway, but it cannot cover everyone:
  // it is deliberately fallible, and accounts created before the community
  // graph existed never saw it. Joining here repairs both, and because joining
  // is idempotent an app user who already has a node just gets it back.
  const node = await joinCommunityGraph(userId);
  const centre: WorldPosition = { x: node.x, y: node.y };

  return readWindow(centre, MAX_NEIGHBOURHOOD_NODES, userId);
}

/**
 * A bounded window on the real community graph for someone with no node of
 * their own — a visitor, or a member whose own read did not answer.
 *
 * Centred on the community origin rather than on anybody, so it is the same
 * graph for everyone who asks and nothing about the caller shapes it. There is
 * no "You" in it: `isViewer` is false throughout.
 *
 * The community is small, so this window is sparse, and it is empty until
 * somebody joins. That is the honest answer and the landing draws it as such —
 * padding the set with invented nodes would make the hero a picture of a
 * community rather than the community.
 */
export async function getPublicWindow(): Promise<GraphWindow> {
  return readWindow(COMMUNITY_ORIGIN, MAX_PUBLIC_WINDOW_NODES);
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
 * Recompute what this app user's contributions have earned and raise the stored
 * tier to match.
 *
 * **It raises and never lowers.** `personalization_tier_earned` is the highest
 * value ever reached — `CONTEXT.md`, under **Personalization tier** — while
 * `deriveEarnedTier`'s answer is a statement about right now and can fall:
 * importing a second transcript leaves imported courses unreviewed again and
 * turns tier 3's condition false. The earned tier still stands. Do not "fix"
 * that asymmetry by writing the computed value straight into the column; the
 * `greatest` in `raiseEarnedTier` is there to make the mistake impossible even
 * if somebody tries. Decay is the other half of the same policy and is derived
 * at read time by `getEffectiveTier`, which stores nothing.
 *
 * Reports the tier the contributions earn and whether the column actually
 * moved. Those are different answers whenever the recompute is at or below
 * what is already stored, which is the normal case for a repeat run.
 */
export async function recordEarnedPersonalizationTier(
  userId: string,
): Promise<{ earned: number; raised: boolean }> {
  const [reviews, transcriptImportedCourses] = await Promise.all([
    graphRepo.findReviewedCourses(userId),
    graphRepo.findTranscriptImportedCourses(userId),
  ]);

  const earned = deriveEarnedTier({
    userId,
    reviews,
    transcriptImportedCourses,
  });
  // Tier 0 is the column default and cannot raise anything, so the write is
  // skipped rather than issued and thrown away.
  const raised =
    earned > 0 && (await graphRepo.raiseEarnedTier(userId, earned));
  return { earned, raised };
}

/**
 * How many app users one backfill page recomputes.
 *
 * A page is a bound on the work in flight, not on the run: the backfill keeps
 * asking until a page comes back short. Small, because each app user in it
 * costs two reads and possibly a write, and nothing is waiting on the result.
 */
const TIER_BACKFILL_PAGE = 200;

/**
 * Give every app user who already contributed the tier they already earned.
 *
 * The writer above only fires on a *new* review or a *new* import, so on the
 * day this ships, everybody who reviewed or imported before it exists is still
 * at the column default and still sees three locked axes until they contribute
 * again. This is the one-off that fixes that, and it is safe to run whenever
 * anybody doubts the column: it derives from the same `deriveEarnedTier`, it
 * raises through the same `greatest`, so a second run is a no-op and a run
 * racing a live contribution cannot lower anything.
 *
 * It walks only the app users who could earn something —
 * `findTierCandidateUserIds` — and pages on the user id, so a review published
 * mid-run cannot make it skip somebody. One app user at a time rather than a
 * single statement, because the rule that decides a tier is TypeScript and
 * expressing it again in SQL is exactly the second definition #161 forbids.
 *
 * Unlike the per-contribution path this does **not** swallow: a backfill that
 * half-ran and reported success is worse than one that stops and says where.
 */
export async function backfillEarnedPersonalizationTiers(
  pageSize: number = TIER_BACKFILL_PAGE,
): Promise<{ scanned: number; raised: number }> {
  let after: string | null = null;
  let scanned = 0;
  let raised = 0;

  for (;;) {
    const userIds: string[] = await graphRepo.findTierCandidateUserIds(
      after,
      pageSize,
    );
    if (userIds.length === 0) return { scanned, raised };

    for (const userId of userIds) {
      const result = await recordEarnedPersonalizationTier(userId);
      scanned += 1;
      if (result.raised) raised += 1;
    }

    if (userIds.length < pageSize) return { scanned, raised };
    after = userIds[userIds.length - 1] ?? null;
  }
}

/**
 * Recompute the earned tier after a contribution that could have raised it.
 *
 * **When this runs.** The two moments the inputs change are publishing a review
 * and confirming a transcript import, and both call this immediately after
 * their own write commits — `reviews/service.ts` and
 * `ingest/transcript/service.ts`. A background job would leave a member staring
 * at a locked axis for however long the job's period is, and computing it at
 * read time would mean `graph.effectiveTier` wrote to the database, which the
 * whole tier design says it must not.
 *
 * **Why after the write rather than inside its transaction.** Recomputing
 * inside would mean the reviews repository reading `user_taken_courses` and
 * writing `users`, which is the layering this repo enforces with Biome, for a
 * guarantee that is not needed: the recompute reads committed state and the
 * write is `greatest`, so it is idempotent and order-independent. Two
 * contributions racing cannot produce a wrong number, and a recompute that is
 * lost costs a tier that the next contribution recomputes anyway.
 *
 * **Why it swallows.** A member who published a review has published it. Losing
 * their review, or seeing their transcript import fail, because a cosmetic
 * number could not be updated would be a much worse trade — the same reasoning,
 * and the same shape, as `joinCommunityGraphOnSignUp`.
 *
 * Not called on deletion. Removing a review or an imported course can only make
 * a lower tier true, and the column does not go down, so there is nothing to
 * write. Removing an imported course can also complete a transcript and make
 * tier 3 true; that raise waits for the next contribution rather than putting a
 * tier write on a delete path, and #161 settles the ladder, not its latency.
 */
export async function recordEarnedPersonalizationTierOnContribution(
  userId: string,
): Promise<void> {
  try {
    await recordEarnedPersonalizationTier(userId);
  } catch (error) {
    console.error(
      `Could not update the earned personalization tier for app user ${userId}:`,
      error,
    );
  }
}

/**
 * The bounded read both windows are: the nearest `limit` nodes to `centre`, the
 * backbone edges spanning exactly that set, and nothing else.
 *
 * This is `personal-community-viewport.md`'s "Bounded rendering" in one place —
 * read a position, select a bounded set with a product-defined maximum, load
 * only the edges that set needs — so neither caller can quietly widen it.
 */
async function readWindow(
  centre: WorldPosition,
  limit: number,
  viewerUserId?: string,
): Promise<GraphWindow> {
  const nodes = await graphRepo.findNearestNodes(centre, limit);
  const edges = await graphRepo.findBackboneEdgesWithin(
    nodes.map((node) => node.userId),
  );
  return anonymise({ centre, nodes, edges, viewerUserId });
}

/**
 * Swap every user id for an opaque token that lives as long as this response.
 *
 * The tokens are random rather than positional: an index would be stable across
 * reads of a graph that barely changes, which is most of the way back to an
 * identifier. Edges are re-expressed in the same tokens and any edge with an
 * end outside the set is dropped — the repository query already scopes to it,
 * and narrowing here too keeps the guarantee true of the service whatever that
 * query later becomes.
 */
function anonymise(args: {
  centre: WorldPosition;
  nodes: NeighbourNode[];
  edges: BackboneEdge[];
  viewerUserId?: string;
}): GraphWindow {
  const tokens = new Map<string, string>();
  const nodes = args.nodes.map((node) => {
    const id = crypto.randomUUID();
    tokens.set(node.userId, id);
    return {
      id,
      x: node.x,
      y: node.y,
      color: node.color,
      isViewer: node.userId === args.viewerUserId,
    };
  });

  const edges: WindowEdge[] = [];
  for (const edge of args.edges) {
    const fromId = tokens.get(edge.nodeUserId);
    const toId = tokens.get(edge.anchorUserId);
    if (fromId && toId) edges.push({ fromId, toId });
  }

  return { centre: args.centre, nodes, edges };
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
  position: WorldPosition,
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
