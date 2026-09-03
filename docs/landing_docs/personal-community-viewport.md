# Personal community viewport strategy

Updated: 2026-08-29  
Status: approved graph direction reflected in the current Lucidchart target.

## Product behavior

The community is a persistent global graph with a virtual coordinate system. A returning user keeps the same world-space position and a familiar local neighborhood. The landing page renders a bounded viewport around that position rather than rebuilding the entire graph or generating new positions and edges on every visit.

World coordinates are not browser pixels. The frontend projects them into the current device and may apply responsive content-avoidance adjustments without changing the persisted position:

```text
screenX = (node.x - currentUser.x) * scale + viewportCenterX
screenY = (node.y - currentUser.y) * scale + viewportCenterY
```

Do not persist viewport width, height, or browser-specific screen coordinates. A separate camera-preference record is unnecessary until free pan/zoom and resume-last-view become explicit features.

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

1. Read the current user's persistent `x`/`y`.
2. Select a bounded nearby/relevant node set with a product-defined maximum.
3. Load the backbone edges needed for that set.
4. Project world coordinates into the current viewport.
5. Render only that local neighborhood.

The maximum visible-node count is a frontend/query policy, not a column in the database target.

## Persistence boundary

- Persist: user/node identity, world-space position, backbone anchors, node appearance, earned personalization tier.
- Derive: effective tier after inactivity, selected local nodes, screen coordinates, responsive keep-out adjustments.
- Defer: friendships, wormhole storage, user camera/zoom preferences, non-user graph entities.
