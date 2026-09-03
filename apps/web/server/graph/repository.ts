import { and, count, eq, inArray, max, ne, sql } from "drizzle-orm";
import { db } from "../db";
import * as schema from "../db/schema";
import type {
  DEFAULT_NODE_SIGNAL_STYLE,
  DEFAULT_NODE_STYLE,
  NodeColor,
  WorldPosition,
} from "./placement";

/** A node's identity and its persistent world position. */
export type GraphNode = {
  userId: string;
  x: number;
  y: number;
};

/** A node plus the appearance the client needs to draw it. */
export type NeighbourNode = GraphNode & {
  color: string;
  style: string;
  signalStyle: string;
};

/**
 * A stored backbone edge. Its direction records placement history — the newer
 * node to the older anchor. It is not a friendship and carries no social
 * meaning; the UI may draw it undirected.
 */
export type BackboneEdge = {
  nodeUserId: string;
  anchorUserId: string;
};

/** Everything one placement writes, so it lands in a single transaction. */
export type PlacementWrite = {
  node: GraphNode;
  profile: {
    userId: string;
    color: NodeColor;
    style: typeof DEFAULT_NODE_STYLE;
    signalStyle: typeof DEFAULT_NODE_SIGNAL_STYLE;
  };
  edges: BackboneEdge[];
};

/** What the effective personalization tier is derived from. */
export type TierBasis = {
  earnedTier: number;
  accountCreatedAt: Date;
};

export async function findNode(userId: string): Promise<GraphNode | undefined> {
  const [row] = await db
    .select({
      userId: schema.usersGraphNodes.userId,
      x: schema.usersGraphNodes.x,
      y: schema.usersGraphNodes.y,
    })
    .from(schema.usersGraphNodes)
    .where(eq(schema.usersGraphNodes.userId, userId))
    .limit(1);
  return row;
}

export async function countNodes(): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(schema.usersGraphNodes);
  return row?.value ?? 0;
}

/**
 * The `limit` nodes closest to `origin` in world space, nearest first.
 *
 * `limit` is a query policy the caller owns — the bound is never a column.
 */
export async function findNearestNodes(
  origin: WorldPosition,
  limit: number,
  excludeUserId?: string,
): Promise<NeighbourNode[]> {
  const dx = sql`${schema.usersGraphNodes.x} - ${origin.x}`;
  const dy = sql`${schema.usersGraphNodes.y} - ${origin.y}`;
  // Squared distance: monotonic in distance, and it avoids a sqrt per row.
  const distance = sql`(${dx}) * (${dx}) + (${dy}) * (${dy})`;

  return (
    db
      .select({
        userId: schema.usersGraphNodes.userId,
        x: schema.usersGraphNodes.x,
        y: schema.usersGraphNodes.y,
        color: sql<string>`coalesce(${schema.usersNodeProfiles.color}, 'default')`,
        style: sql<string>`coalesce(${schema.usersNodeProfiles.style}::text, 'default')`,
        signalStyle: sql<string>`coalesce(${schema.usersNodeProfiles.signalStyle}::text, 'default')`,
      })
      .from(schema.usersGraphNodes)
      .leftJoin(
        schema.usersNodeProfiles,
        eq(schema.usersNodeProfiles.userId, schema.usersGraphNodes.userId),
      )
      .where(
        excludeUserId
          ? ne(schema.usersGraphNodes.userId, excludeUserId)
          : undefined,
      )
      // The node id breaks distance ties so paging and repeat reads are stable.
      .orderBy(distance, schema.usersGraphNodes.userId)
      .limit(limit)
  );
}

/**
 * Write one placement: the node, its profile and its backbone edges, together.
 *
 * Every insert is `on conflict do nothing`, so re-running a placement can never
 * move a node that is already there or duplicate a backbone edge. The
 * `no_self_backbone_edge` check constraint rejects self-edges in the database
 * even if a caller ever asks for one.
 */
export async function persistPlacement(write: PlacementWrite): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(schema.usersGraphNodes)
      .values(write.node)
      .onConflictDoNothing();
    await tx
      .insert(schema.usersNodeProfiles)
      .values(write.profile)
      .onConflictDoNothing();
    if (write.edges.length > 0) {
      await tx
        .insert(schema.usersGraphBackboneEdges)
        .values(write.edges)
        .onConflictDoNothing();
    }
  });
}

/** Backbone edges with both endpoints inside `userIds`. */
export async function findBackboneEdgesWithin(
  userIds: string[],
): Promise<BackboneEdge[]> {
  if (userIds.length === 0) return [];
  return db
    .select({
      nodeUserId: schema.usersGraphBackboneEdges.nodeUserId,
      anchorUserId: schema.usersGraphBackboneEdges.anchorUserId,
    })
    .from(schema.usersGraphBackboneEdges)
    .where(
      and(
        inArray(schema.usersGraphBackboneEdges.nodeUserId, userIds),
        inArray(schema.usersGraphBackboneEdges.anchorUserId, userIds),
      ),
    );
}

export async function findTierBasis(
  userId: string,
): Promise<TierBasis | undefined> {
  const [row] = await db
    .select({
      earnedTier: schema.users.personalizationTierEarned,
      accountCreatedAt: schema.users.createdAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  return row;
}

/**
 * The app user's most recent review, or `null` if they have never reviewed.
 *
 * This reads the reviews table directly, which crosses a domain boundary the
 * repo normally routes service -> service. The exception is deliberate and
 * approved: it is a single read-only aggregate, `reviews_user_id_idx` covers
 * it, and routing it through `server/reviews/service.ts` would couple the graph
 * domain to a review domain that is being rewritten in parallel. Nothing else
 * here may reach into `server/reviews/`.
 */
export async function findLastReviewAt(userId: string): Promise<Date | null> {
  const [row] = await db
    .select({ lastReviewAt: max(schema.reviews.createdAt) })
    .from(schema.reviews)
    .where(eq(schema.reviews.userId, userId));
  return row?.lastReviewAt ?? null;
}
