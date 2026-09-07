# Shared community viewport strategy

Updated: 2026-09-07  
Status: approved graph direction reflected in the current Lucidchart target.

Supersedes the personal-viewport rule this document carried until 2026-09-07, under which each member's window was centred on their own node. See "One graph, one centre" below for why that was reversed.

## Product behavior

The community is a persistent global graph with a virtual coordinate system. A returning user keeps the same world-space position and the same neighbors around it. The landing page renders a bounded viewport on that graph rather than rebuilding it or generating new positions and edges on every visit.

World coordinates are not browser pixels. The frontend projects them into the current device and may apply responsive content-avoidance adjustments without changing the persisted position:

```text
screenX = (node.x - communityOrigin.x) * scale + cameraX
screenY = (node.y - communityOrigin.y) * scale + cameraY
```

Do not persist viewport width, height, or browser-specific screen coordinates. A separate camera-preference record is unnecessary until free pan/zoom and resume-last-view become explicit features.

## One graph, one centre

Every window is centred on the community origin, for members and visitors alike. A member is **not** drawn at the middle of their own screen.

The rule this replaces centred each member's window on their own node. That is a claim the data does not support: if every reader is the centre, then two members comparing screens are both the centre, and the graph reads as a diorama generated per viewer rather than as one community they are both in. Centring everyone on the origin makes a member's position checkable — the same nodes in the same arrangement on both screens, with two different dots lit up.

Finding yourself is the camera's job, on the client, and it is deliberately the smallest possible intervention:

1. Choose the camera from the frame and the copy alone, exactly as a visitor's page does.
2. If the reader's own node would fall outside the canvas, translate the camera by the fewest pixels that bring it inside, and by no more.

A pan translates every node equally, so it changes which part of the graph is on screen and never what the graph looks like. For a member near the origin it moves nothing at all, and their page is byte-identical to the visitor's. Panning further than step 2 requires is how a shared picture turns back into a personal one, so it is not done.

Nodes pushed off the far edge by that pan are not a failure. A member out at the rim seeing the community from the rim is the honest picture; the rest of the graph is still there, simply not in this viewport.

The reader's own node must always be **in the payload**, even when the bounded set would not have reached it. Once the community is larger than the visible-node maximum, a member out past that bound is not among the nodes nearest the origin, and no amount of panning can show a dot the response does not contain.

## Lucidchart target

The canonical column inventory remains [`planned-schema-lucid.json`](../schema_docs/planned-schema-lucid.json). The graph portion is:

```sql
create table users_graph_nodes (
    user_id text primary key references users(id),
    x double precision not null,
    y double precision not null,
    created_at timestamptz not null,
    updated_at timestamptz not null
);

create table users_graph_backbone_edges (
    node_user_id text references users_graph_nodes(user_id),
    anchor_user_id text references users_graph_nodes(user_id),
    created_at timestamptz not null,
    primary key (node_user_id, anchor_user_id),
    check (node_user_id <> anchor_user_id)
);

create table users_node_profiles (
    user_id text primary key references users(id),
    color text not null,
    style node_style not null,
    signal_style node_signal_style not null,
    created_at timestamptz not null,
    updated_at timestamptz not null
);
```

`users.personalization_tier_earned` is a required small integer with default 0 and range 0–3. Effective inactivity decay is derived from review activity and does not rewrite the earned tier. Exact color options and the values of `node_style` and `node_signal_style` remain product decisions.

## Backbone semantics

When a user joins, assign and persist a world position and connect the new node to roughly 3–5 established anchors. The stored direction is new node → older anchor and records placement history. The frontend may render the connection as visually undirected.

Backbone edges are not friendships. A future friend feature may provide a “wormhole” that moves the camera to a friend's neighborhood without changing either user's graph placement or backbone connections. If the friend already appears in the current viewport, the UI can move directly to that node's neighborhood without a separate portal.

Do not globally reposition established users whenever the community grows. Add new users primarily at outer regions and prefer local, controlled evolution over a continuously optimized global layout.

## Bounded rendering

The landing page never loads the whole community:

1. Select a bounded node set around the community origin, with a product-defined maximum.
2. For a signed-in reader, add their own node to that set if it is not already in it, and flag it as theirs.
3. Load the backbone edges needed for the resulting set.
4. Project world coordinates into the current viewport.
5. Render that set.

The maximum visible-node count is a frontend/query policy, not a column in the database target. It is one number, not one per caller: a member and a visitor are served the same slice of the same graph, and a second bound would be a second picture waiting to happen.

## Persistence boundary

- Persist: user/node identity, world-space position, backbone anchors, node appearance, earned personalization tier.
- Derive: effective tier after inactivity, selected local nodes, screen coordinates, responsive keep-out adjustments.
- Defer: friendships, wormhole storage, user camera/zoom preferences, non-user graph entities.
