import {
  and,
  count,
  eq,
  inArray,
  isNotNull,
  lt,
  max,
  ne,
  sql,
} from "drizzle-orm";
import { db } from "../db";
import * as schema from "../db/schema";
import type {
  NodeAppearance,
  NodeAppearanceChoice,
  StoredNodeColor,
  StoredNodeSignalStyle,
  StoredNodeStyle,
} from "./appearance";
import type { WorldPosition } from "./placement";

/** A node's identity and its persistent world position. */
export type GraphNode = {
  userId: string;
  x: number;
  y: number;
};

/**
 * A node plus the appearance **as stored**, which is not always the appearance
 * it draws with: a member whose tier has decayed keeps their pick in the column
 * and renders unconfigured until it comes back. Masking that is the service's
 * job — see `renderedAppearance` — because it needs the tier basis this row does
 * not carry.
 *
 * The three fields are plain `string` rather than the stored unions because they
 * come back from a `coalesce` over a left join: a node with no profile row at
 * all is legal and reads as `"default"` on every axis.
 */
export type NeighbourNode = GraphNode & {
  color: string;
  style: string;
  signalStyle: string;
};

/**
 * What deciding one app user's *effective* tier needs, for a whole window of
 * them at once.
 *
 * `lastReviewAt` is null for somebody who has never reviewed; the service falls
 * back to `accountCreatedAt` there, exactly as the single-user read does, so a
 * brand-new account is not instantly decayed.
 */
export type NodeTierBasis = TierBasis & {
  userId: string;
  lastReviewAt: Date | null;
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
    color: StoredNodeColor;
    style: StoredNodeStyle;
    signalStyle: StoredNodeSignalStyle;
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
 * The node insert is the gate. `on conflict do nothing ... returning` inserts a
 * row and hands it back, or hands back nothing because a placement for this app
 * user committed first. When it hands back nothing the whole placement is
 * abandoned — profile and backbone edges included — so a node that is already
 * there can never be moved, and can never collect a second set of anchors from
 * a placement that lost the race. `undefined` tells the caller that happened.
 *
 * The profile and edge inserts stay `on conflict do nothing` so that repairing
 * a half-written placement is safe. Duplicate backbone edges are impossible by
 * composite primary key, and `no_self_backbone_edge` rejects a self-edge in the
 * database even if a caller ever asks for one.
 */
export async function persistPlacement(
  write: PlacementWrite,
): Promise<GraphNode | undefined> {
  return db.transaction(async (tx) => {
    const [placed] = await tx
      .insert(schema.usersGraphNodes)
      .values(write.node)
      .onConflictDoNothing()
      .returning({
        userId: schema.usersGraphNodes.userId,
        x: schema.usersGraphNodes.x,
        y: schema.usersGraphNodes.y,
      });
    if (!placed) return undefined;

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
    return placed;
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
 * domain to a review domain that is being rewritten in parallel.
 *
 * `findReviewedCourses` and `findNodeTierBases` below are the same exception
 * for the same reason. Those three are the whole of it: nothing else here may
 * reach into `server/reviews/`, and none of them may grow a write.
 */
export async function findLastReviewAt(userId: string): Promise<Date | null> {
  const [row] = await db
    .select({ lastReviewAt: max(schema.reviews.createdAt) })
    .from(schema.reviews)
    .where(eq(schema.reviews.userId, userId));
  return row?.lastReviewAt ?? null;
}

/**
 * Which courses this app user has reviewed, as review rows rather than bare
 * codes.
 *
 * `userId` comes back on every row even though the query already filtered on
 * it, so the result is the exact shape `selectUnreviewedCourses` takes. That is
 * the point: the tier rule runs the same author comparison the browser runs,
 * through the same function, instead of trusting this `WHERE` to have meant the
 * same thing. Read-only, and covered by `reviews_user_id_idx`.
 */
export function findReviewedCourses(
  userId: string,
): Promise<{ courseCode: string; userId: string }[]> {
  return db
    .select({
      courseCode: schema.reviews.courseCode,
      userId: schema.reviews.userId,
    })
    .from(schema.reviews)
    .where(eq(schema.reviews.userId, userId));
}

/**
 * The courses this app user got from a transcript import.
 *
 * `transcript_imported_at is not null` is the whole test, and it is the one
 * #161 names: a course typed in by hand carries no import stamp and cannot earn
 * tier 2 or 3. The primary key on `(user_id, course_code)` leads with
 * `user_id`, so this read is indexed.
 *
 * It reads `user_taken_courses`, which belongs to the taken domain, and it is
 * here for the same reason `findLastReviewAt` is: one read-only projection
 * feeding one derived number, where routing through `taken/service.ts` would
 * buy nothing but a cycle — `taken` has no business knowing about tiers.
 */
export function findTranscriptImportedCourses(
  userId: string,
): Promise<{ courseCode: string }[]> {
  return db
    .select({ courseCode: schema.userTakenCourses.courseCode })
    .from(schema.userTakenCourses)
    .where(
      and(
        eq(schema.userTakenCourses.userId, userId),
        isNotNull(schema.userTakenCourses.transcriptImportedAt),
      ),
    );
}

/**
 * A page of the app users whose contributions could earn a tier at all: they
 * have reviewed something, or they have a transcript-imported course.
 *
 * This exists for the backfill, and the narrowing is the whole point of it.
 * Every other app user is at the column default with nothing to raise them
 * above it, so walking the entire `users` table would be a recompute per
 * account to learn what the absence of a row already says.
 *
 * Paged on the user id with a cursor rather than an offset, so a page cannot
 * skip or repeat an app user because a review landed mid-run. `after` is the
 * last id of the previous page; `null` starts at the beginning.
 */
export async function findTierCandidateUserIds(
  after: string | null,
  limit: number,
): Promise<string[]> {
  const candidates = await db.execute<{ user_id: string }>(sql`
    select user_id
    from (
      select distinct ${schema.reviews.userId} as user_id
      from ${schema.reviews}
      union
      select distinct ${schema.userTakenCourses.userId} as user_id
      from ${schema.userTakenCourses}
      where ${schema.userTakenCourses.transcriptImportedAt} is not null
    ) as tier_candidates
    where ${after === null ? sql`true` : sql`user_id > ${after}`}
    order by user_id
    limit ${limit}
  `);
  return candidates.rows.map((row) => row.user_id);
}

/**
 * Raise `personalization_tier_earned` to `tier`, and never lower it.
 *
 * The monotonicity is enforced in SQL rather than in the caller. `greatest` is
 * what makes it hold under concurrency: two contributions landing at once
 * cannot have the slower one write a stale, smaller number over the faster
 * one's, and a recompute that answers 2 where the column already says 3 — which
 * #161's ladder allows, because tier 3's condition stops holding the moment a
 * further transcript is imported — is a no-op rather than a demotion. The `<`
 * in the `WHERE` only spares the row a write it does not need; delete it and
 * the column is still correct.
 *
 * Returns whether the column actually rose.
 */
export async function raiseEarnedTier(
  userId: string,
  tier: number,
): Promise<boolean> {
  const raised = await db
    .update(schema.users)
    .set({
      personalizationTierEarned: sql`greatest(${schema.users.personalizationTierEarned}, ${tier})`,
    })
    .where(
      and(
        eq(schema.users.id, userId),
        lt(schema.users.personalizationTierEarned, tier),
      ),
    )
    .returning({ userId: schema.users.id });
  return raised.length > 0;
}

/**
 * The tier basis for a whole window of app users, in one read.
 *
 * The landing hero masks a dormant axis back to unconfigured, which needs an
 * effective tier per node rather than only for the viewer — so this is
 * `findTierBasis` and `findLastReviewAt` for up to `MAX_PUBLIC_WINDOW_NODES`
 * people at once. One grouped join rather than a query per node: a 150-node
 * window would otherwise be 300 round trips on every load of `/`.
 *
 * The left join is what makes an app user who has never reviewed come back at
 * all, with a null `lastReviewAt` for the service to fall back from. Both sides
 * are indexed — `users` by primary key, `reviews` by `reviews_user_id_idx`.
 *
 * It returns **no appearance and no name**: this answers "how far has each of
 * these people decayed", nothing else, and the public window must never learn a
 * user id it did not already have.
 */
export async function findNodeTierBases(
  userIds: string[],
): Promise<NodeTierBasis[]> {
  if (userIds.length === 0) return [];
  return (
    db
      .select({
        userId: schema.users.id,
        earnedTier: schema.users.personalizationTierEarned,
        accountCreatedAt: schema.users.createdAt,
        lastReviewAt: max(schema.reviews.createdAt),
      })
      .from(schema.users)
      .leftJoin(schema.reviews, eq(schema.reviews.userId, schema.users.id))
      .where(inArray(schema.users.id, userIds))
      // Grouping on the primary key alone is legal here and deliberate: Postgres
      // treats every other `users` column as functionally dependent on it, so
      // `personalization_tier_earned` and `created_at` need not be repeated in
      // the clause and the aggregate stays over `reviews` only.
      .groupBy(schema.users.id)
  );
}

/**
 * One app user's stored node profile, or `undefined` if they have no row.
 *
 * No row is a normal state, not an error: `users_node_profiles` is written on
 * placement, and accounts that predate the community graph never saw it. The
 * service reads the absence as `UNCONFIGURED_APPEARANCE`, which is exactly what
 * the column defaults would have stored.
 *
 * This returns what is **stored**, never what renders. Decay is applied above.
 */
export async function findNodeProfile(
  userId: string,
): Promise<NodeAppearance | undefined> {
  const [row] = await db
    .select({
      color: schema.usersNodeProfiles.color,
      style: schema.usersNodeProfiles.style,
      signalStyle: schema.usersNodeProfiles.signalStyle,
    })
    .from(schema.usersNodeProfiles)
    .where(eq(schema.usersNodeProfiles.userId, userId))
    .limit(1);
  // `color` is a free-text column, so a name this build has never heard of is
  // possible and the cast is the honest place to admit it. The client draws an
  // unrecognised name as unconfigured rather than dropping the node.
  return row as NodeAppearance | undefined;
}

/**
 * Write one app user's chosen appearance, creating their profile row if they
 * have none.
 *
 * **A patch, not a row.** Only the axes named in `choice` are written; an axis
 * left out keeps whatever it held, which is what makes a dormant pick survive a
 * write to a different axis. There is no path here that clears a column because
 * a tier decayed — decay is masked at read time and this repository has no
 * opinion about tiers at all. Un-picking is a member choosing `"default"`, and
 * arrives as an ordinary value.
 *
 * `on conflict do update` rather than a read-then-write, so two clicks landing
 * together cannot lose one another's axis: each statement touches only the
 * columns it names.
 *
 * The whole stored appearance comes back, so the caller never has to guess what
 * the untouched axes were or issue a second read to find out.
 */
export async function upsertNodeProfile(
  userId: string,
  choice: NodeAppearanceChoice,
): Promise<NodeAppearance> {
  const [row] = await db
    .insert(schema.usersNodeProfiles)
    .values({ userId, ...choice })
    .onConflictDoUpdate({
      target: schema.usersNodeProfiles.userId,
      set: { ...choice, updatedAt: new Date() },
    })
    .returning({
      color: schema.usersNodeProfiles.color,
      style: schema.usersNodeProfiles.style,
      signalStyle: schema.usersNodeProfiles.signalStyle,
    });
  if (!row) {
    throw new Error(`Could not write the node profile for app user ${userId}`);
  }
  return row as NodeAppearance;
}
