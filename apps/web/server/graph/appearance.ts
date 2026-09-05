/**
 * Node appearance: the three axes a member may personalise, what each axis
 * offers, and which personalization tier unlocks it.
 *
 * This is the **one definition** of that vocabulary, and it sits in `server/`
 * for the same reason `server/reviews/unreviewed.ts` does: Biome forbids server
 * code importing from `features/`, so anything both halves must agree on has to
 * live on the side the other can reach. `features/my-page/lib/
 * personalization-tiers.ts` re-exports it. Do not write a second copy of the
 * ladder — the tier gate in `graph/service.ts` and the picker on My Page have to
 * be the *same* rule, or a member is offered an option the server will refuse.
 *
 * **Names, never hex.** The server stores a name on every axis and the client
 * maps it onto a `--cc-*` custom property, so the palette can be re-skinned in
 * CSS without a data migration. `docs/design_ref/2026-09-05/cc-store.js` inverts
 * that — its `NODE_COLORS` is five raw hex strings — and is wrong about the
 * shape rather than about the colours.
 *
 * **Which tier unlocks which axis was settled by the product owner on
 * 2026-09-05: the rendered My Page artboard wins.** That artboard draws
 * `mk(1, "Dot color", …)`, `mk(2, "Dot style", …)`, `mk(3, "Signal on click",
 * …)`, while `cc-store.js`'s `TIER_AXES` constant says
 * `{ 1: "color", 2: "signalStyle", 3: "style" }` — the opposite pairing for 2
 * and 3. `cc-store.js` is the erroneous half and wants correcting at source.
 */

/**
 * What an unconfigured axis stores, and what a dormant one renders as. It is
 * the column default on all three columns of `users_node_profiles`, and it is
 * a legal *choice* as well as a default — un-picking is picking `"default"`.
 */
export const UNCONFIGURED = "default" as const;

/**
 * The node colour palette. Six names, mapped to `--cc-node-*` tokens by
 * `features/landing/lib/neighbourhood-view.ts`.
 */
export const NODE_COLORS = [
  "aurora",
  "ember",
  "frost",
  "moss",
  "slate",
  "violet",
] as const;

/**
 * The node shapes, from `cc-store.js`'s `NODE_STYLES`. These are geometry the
 * hero canvas draws, not tokens: `solid` is the filled dot every node has always
 * been, `ring` is the same dot stroked and hollow, `diamond` is it turned on its
 * point.
 */
export const NODE_STYLES = ["solid", "ring", "diamond"] as const;

/**
 * The signal styles, from `cc-store.js`'s `NODE_SIGNAL_STYLES`.
 *
 * A **signal** is ongoing — `CONTEXT.md` — so it is drawn on every paint of a
 * node that carries one, unlike the **pulse** that **Find your dot** shows once
 * on the viewer's own node. The two are different things and this file names
 * neither of them `pulse`; `cc-store.js`'s *other* signal list, `DOT_SIGNALS =
 * ["ripple", "pulse", "spark"]`, does, and would collide with the glossary. It
 * is a third naming of this axis in one export and the settled set is this one.
 */
export const NODE_SIGNAL_STYLES = ["fade", "comet", "dashed"] as const;

export type NodeColor = (typeof NODE_COLORS)[number];
export type NodeStyle = (typeof NODE_STYLES)[number];
export type NodeSignalStyle = (typeof NODE_SIGNAL_STYLES)[number];

/** Every value each column may hold: the unconfigured state, or a chosen name. */
export type StoredNodeColor = NodeColor | typeof UNCONFIGURED;
export type StoredNodeStyle = NodeStyle | typeof UNCONFIGURED;
export type StoredNodeSignalStyle = NodeSignalStyle | typeof UNCONFIGURED;

/** What placement writes, matching the column defaults on `users_node_profiles`. */
export const DEFAULT_NODE_COLOR = UNCONFIGURED;
export const DEFAULT_NODE_STYLE = UNCONFIGURED;
export const DEFAULT_NODE_SIGNAL_STYLE = UNCONFIGURED;

/**
 * A name on each axis, without promising it is one this build knows.
 *
 * The window read gets its three names out of a `coalesce` over a left join and
 * `color` is a free-text column besides, so an unrecognised name is possible and
 * this is the honest type for it. The client draws one as unconfigured rather
 * than dropping somebody out of a neighbourhood.
 */
export type AppearanceNames = {
  color: string;
  style: string;
  signalStyle: string;
};

/** One node's stored appearance, all three axes together. */
export type NodeAppearance = {
  color: StoredNodeColor;
  style: StoredNodeStyle;
  signalStyle: StoredNodeSignalStyle;
};

/** What a node with no profile row, or with every axis dormant, looks like. */
export const UNCONFIGURED_APPEARANCE: NodeAppearance = {
  color: DEFAULT_NODE_COLOR,
  style: DEFAULT_NODE_STYLE,
  signalStyle: DEFAULT_NODE_SIGNAL_STYLE,
};

/**
 * The three axes, in the order My Page lists them, each with the tier that
 * unlocks it and the options it offers.
 *
 * `unlockHint` states ADR 0005's ladder, which is what `graph/tier.ts` actually
 * enforces. The artboard's own copy named a different ladder entirely — five
 * reviews, then a fully reviewed transcript, then *referring friends*, a feature
 * that does not exist — and a hint naming an unearnable act is a promise the app
 * cannot keep, so the rule the code enforces is the one shown.
 *
 * `UNCONFIGURED` is not listed in `options`: it is on every axis by definition
 * and the picker adds it at the head of each row, because it is what a node
 * looks like before anybody chooses and what it settles back to when a tier
 * decays.
 */
export const PERSONALIZATION_AXES = [
  {
    key: "color",
    tier: 1,
    title: "Dot color",
    unlockHint: "Unlocks when you publish your first review.",
    options: NODE_COLORS,
  },
  {
    key: "style",
    tier: 2,
    title: "Dot style",
    unlockHint: "Unlocks when you import a transcript.",
    options: NODE_STYLES,
  },
  {
    key: "signalStyle",
    tier: 3,
    title: "Signal on click",
    unlockHint: "Unlocks when every course in your transcript has your review.",
    options: NODE_SIGNAL_STYLES,
  },
] as const;

export type PersonalizationAxis = (typeof PERSONALIZATION_AXES)[number];
export type PersonalizationAxisKey = PersonalizationAxis["key"];

/** A choice on some of the axes. An absent key is left exactly as it is. */
export type NodeAppearanceChoice = Partial<NodeAppearance>;

/**
 * Where one axis stands for a member, given both of their tier numbers.
 *
 * The third state is the whole reason `graph.personalization` returns two
 * numbers rather than one. **Dormant is not locked**: the axis was earned, the
 * pick is still stored, and reviewing again brings it back — `cc-store.js`,
 * "Values stay stored while an axis is dormant; reviewing again restores them."
 * Telling a member they had lost something the database still holds would be a
 * lie about their own history.
 */
export type AxisState = "unlocked" | "dormant" | "locked";

/**
 * `effectiveTier` decides what may be edited; `earnedTier` only separates
 * dormant from locked. Both are floored and clamped rather than trusted: the
 * column allows 0-3 today and a build meeting a wider value should still render
 * three sensible rows instead of throwing on somebody's own page.
 */
export function axisState(
  axis: { tier: number },
  earnedTier: number,
  effectiveTier: number,
): AxisState {
  const effective = wholeTier(effectiveTier);
  if (effective >= axis.tier) return "unlocked";
  return wholeTier(earnedTier) >= axis.tier ? "dormant" : "locked";
}

function wholeTier(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

/**
 * The appearance a node actually renders as, once decay is applied.
 *
 * A dormant axis draws as unconfigured while its stored value is left alone —
 * this masks, it never deletes, and there is deliberately no write anywhere in
 * this file. My Page's own copy promises exactly this: "Go quiet for a while and
 * it settles back to default." Restoring is nothing more than the effective tier
 * rising again, which a single qualifying review does.
 */
export function renderedAppearance(
  stored: AppearanceNames,
  earnedTier: number,
  effectiveTier: number,
): AppearanceNames {
  const rendered = { ...stored };
  for (const axis of PERSONALIZATION_AXES) {
    if (axisState(axis, earnedTier, effectiveTier) !== "unlocked") {
      rendered[axis.key] = UNCONFIGURED;
    }
  }
  return rendered;
}
