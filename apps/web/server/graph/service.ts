import { ForbiddenError, NotFoundError } from "../errors";
import {
  type AppearanceNames,
  DEFAULT_NODE_COLOR,
  DEFAULT_NODE_SIGNAL_STYLE,
  DEFAULT_NODE_STYLE,
  type NodeAppearance,
  type NodeAppearanceChoice,
  PERSONALIZATION_AXES,
  renderedAppearance,
  UNCONFIGURED_APPEARANCE,
} from "./appearance";
import {
  chooseAnchorCount,
  computeWorldPosition,
  type WorldPosition,
} from "./placement";
import type {
  BackboneEdge,
  GraphNode,
  NeighbourNode,
  NodeTierBasis,
} from "./repository";
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
   * The appearance names this node **renders** with, which is its stored
   * profile with every dormant axis masked back to `"default"`. Node appearance
   * is drawn on a public landing page by design, so it is not a disclosure, and
   * these three names are the whole of what leaves: no tier number, no user id,
   * nothing about who decayed.
   *
   * Masking rather than reading the column straight is what My Page's own copy
   * promises — "Go quiet for a while and it settles back to default" — and it
   * is a read-time derivation only. The stored pick is untouched and returns
   * the moment a qualifying review restores the tier.
   */
  color: string;
  style: string;
  signalStyle: string;
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

/** Both tier numbers for one app user, and the appearance they have stored. */
export type NodePersonalization = {
  /** The highest tier ever reached. Never lowered, by anything. */
  earnedTier: number;
  /** What inactivity has left of it. Derived here and stored nowhere. */
  effectiveTier: number;
  /** The stored pick on each axis, unmasked — a dormant axis still shows it. */
  appearance: NodeAppearance;
};

/**
 * Both personalization tier numbers for an app user.
 *
 * **Two numbers, not one, and that is the point.** This read used to answer with
 * the effective tier alone, which left My Page unable to tell a *dormant* axis —
 * earned, decayed, pick still stored — from a *locked* one that was never
 * earned. The artboard has three badges and the UI could only draw two, so it
 * collapsed dormant into "Locked" and told members they had lost something the
 * database still holds. The earned number closes that and does nothing else.
 *
 * Read-only by construction: the earned tier is the highest ever reached and
 * decay is derived from it, never written back.
 */
export async function getPersonalizationTiers(
  userId: string,
  now: Date = new Date(),
): Promise<{ earnedTier: number; effectiveTier: number }> {
  const basis = await graphRepo.findTierBasis(userId);
  if (!basis) throw new NotFoundError(`No such app user: ${userId}`);

  const lastReviewAt = await graphRepo.findLastReviewAt(userId);
  // An app user who has never reviewed decays from when they joined, so a
  // brand-new account is not instantly decayed.
  return {
    earnedTier: basis.earnedTier,
    effectiveTier: deriveEffectiveTier(
      basis.earnedTier,
      lastReviewAt ?? basis.accountCreatedAt,
      now,
    ),
  };
}

/**
 * Everything My Page's "My dot" tab needs: how far this app user has unlocked
 * their node profile, and what they have picked.
 *
 * The appearance comes back **as stored**, deliberately. A dormant axis renders
 * as unconfigured on the landing canvas, but the tab has to show the member the
 * pick that is waiting for them — hiding it would make "reviewing again restores
 * them" unverifiable from the one screen that says it.
 *
 * An app user with no profile row reads as unconfigured on all three axes, which
 * is exactly what the column defaults would have stored for them.
 */
export async function getNodePersonalization(
  userId: string,
  now: Date = new Date(),
): Promise<NodePersonalization> {
  const [tiers, stored] = await Promise.all([
    getPersonalizationTiers(userId, now),
    graphRepo.findNodeProfile(userId),
  ]);
  return { ...tiers, appearance: stored ?? UNCONFIGURED_APPEARANCE };
}

/**
 * Set one or more appearance axes for an app user.
 *
 * **The gate is here, and it is the effective tier.** A caller may only write an
 * axis their *current* tier unlocks: colour needs 1, style 2, signal style 3 —
 * `PERSONALIZATION_AXES`, the same table the picker renders from, so the two
 * cannot drift apart. A dormant axis is refused like a locked one, because the
 * member cannot edit it right now; what separates the two is that the dormant
 * one still holds its value, and nothing in this function goes near a column it
 * was not asked to write.
 *
 * This has to be server-side. The picker knows the tier and disables what is
 * not unlocked, but that is presentation: the mutation is a public tRPC
 * procedure and any signed-in caller can post to it with whatever body they
 * like. A client-side-only gate is not a gate — it is a suggestion, and the
 * database would happily store a tier-3 signal for an account at tier 0.
 *
 * Reports the whole personalization state afterwards, so the caller replaces its
 * cache with a fact rather than patching it with an assumption.
 */
export async function setNodeAppearance(
  userId: string,
  choice: NodeAppearanceChoice,
  now: Date = new Date(),
): Promise<NodePersonalization> {
  const tiers = await getPersonalizationTiers(userId, now);

  for (const axis of PERSONALIZATION_AXES) {
    if (choice[axis.key] === undefined) continue;
    if (tiers.effectiveTier >= axis.tier) continue;
    throw new ForbiddenError(
      `Personalization tier ${axis.tier} is needed to set ${axis.key}`,
    );
  }

  // Nothing to write is not an error — it is a caller that asked for no change.
  // Answering with the current state costs one read and keeps the procedure
  // total, rather than making "did you name an axis" a second failure mode.
  const named = PERSONALIZATION_AXES.some(
    (axis) => choice[axis.key] !== undefined,
  );
  const appearance = named
    ? await graphRepo.upsertNodeProfile(userId, choice)
    : ((await graphRepo.findNodeProfile(userId)) ?? UNCONFIGURED_APPEARANCE);

  return { ...tiers, appearance };
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
  now: Date = new Date(),
): Promise<GraphWindow> {
  const nodes = await graphRepo.findNearestNodes(centre, limit);
  const userIds = nodes.map((node) => node.userId);
  // Two independent reads over the same bounded set. The tier bases are what
  // masks a dormant axis back to unconfigured, and they are fetched for the
  // whole window in one query rather than per node — see `findNodeTierBases`.
  const [edges, tierBases] = await Promise.all([
    graphRepo.findBackboneEdgesWithin(userIds),
    graphRepo.findNodeTierBases(userIds),
  ]);
  return anonymise({ centre, nodes, edges, viewerUserId, tierBases, now });
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
  tierBases: NodeTierBasis[];
  now: Date;
}): GraphWindow {
  const basisByUserId = new Map(
    args.tierBases.map((basis) => [basis.userId, basis]),
  );
  const tokens = new Map<string, string>();
  const nodes = args.nodes.map((node) => {
    const id = crypto.randomUUID();
    tokens.set(node.userId, id);
    // A node whose basis did not come back — an account removed between the two
    // reads — renders unconfigured rather than being dropped or drawn with a
    // pick nothing vouches for. Tier 0 is the same answer the column default
    // gives, so this is the conservative branch and not a special case.
    const appearance = appearanceFor(
      basisByUserId.get(node.userId),
      node,
      args.now,
    );
    return {
      id,
      x: node.x,
      y: node.y,
      color: appearance.color,
      style: appearance.style,
      signalStyle: appearance.signalStyle,
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

/**
 * What one node in a window draws with: its stored appearance, with every axis
 * its owner's effective tier no longer reaches masked back to unconfigured.
 *
 * This is the read-time half of "dormant reverts, it does not lose". Nothing is
 * written, nothing is cleared, and the same stored row produces the full
 * appearance again the moment a qualifying review lifts the effective tier.
 */
function appearanceFor(
  basis: NodeTierBasis | undefined,
  stored: NeighbourNode,
  now: Date,
): AppearanceNames {
  if (!basis) return UNCONFIGURED_APPEARANCE;
  const effectiveTier = deriveEffectiveTier(
    basis.earnedTier,
    basis.lastReviewAt ?? basis.accountCreatedAt,
    now,
  );
  return renderedAppearance(stored, basis.earnedTier, effectiveTier);
}
