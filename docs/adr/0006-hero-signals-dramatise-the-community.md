# 6. The landing hero dramatises backbone edges as social exchange

Date: 2026-09-06

## Status

Accepted. Reverses the reasoning written into `hero-network.tsx`'s header at
#192, and supersedes the `_Today_` clause on **Signal** in `CONTEXT.md`, which
this closes.

## Context

`docs/design_ref/2026-09-06/Course Community - Landing.dc.html` specifies a live
hero: nodes drifting inside a small box around their own position, signals
travelling along edges, and a click fanning one out along every edge a node has
(`burst`, :1140, "A student passing their recommendation to everyone they are
connected to"). `Course Community - My Page.dc.html:715` ties the third
personalization tier to exactly that — "Refer friends to unlock a signal that
goes out from your node."

None of it was carried through. #68's reconciliation retired the artboard's
synthetic Halton field in favour of the real stored graph, which was right, and
the implementation then dropped the motion as a consequence of that, which was
not asked for. `hero-network.tsx` argues the drop at length: once the dots are
real people, a signal along a **backbone edge** would give it "a social meaning
the data does not have", and a travelling signal means a frame loop that never
stops.

The result is a still landing page and a third personalization tier — the only
axis a member reaches by reviewing their entire transcript — whose reward is a
static ring nobody can tell from a slightly different dot. `CONTEXT.md` recorded
this as an open gap rather than a settled position: "Closed by whatever gives the
hero a bounded loop a signal can ride on."

The product owner has settled it: the motion ships, in the artboard's own style.

## Decision

**The hero draws signals travelling along backbone edges, and this is a
dramatisation we are choosing on purpose.** The edge is not a friendship, in the
data or in `CONTEXT.md`, and nothing here writes a row, reads a relationship, or
tells a visitor who knows whom. What the canvas asserts is only that this is a
community and things move through it, which is true. The alternative — a still
graph, honest to the point of being inert — was tried for a release and made the
landing page's most expensive feature indistinguishable from a background image.

Three consequences are load-bearing:

**The frame loop is bounded by gates, not by having nothing to draw.** The old
design's guarantee was "the scene is painted once"; the new one is a loop that
runs only while the hero is visible, un-paused, un-hidden, and motion is allowed.
That is a weaker guarantee and it is the price.

**Every node signals; the tier only picks the style.** Exactly as with colour and
shape, an unconfigured node draws the default. Gating the signal itself on tier 3
would have made the feature invisible on a community where personalisation has
close to no writers, which is the situation #68 recorded and accepted.

**A friendship must never be drawn as an edge on this canvas, and must never emit
a signal.** `docs/landing_docs/personal-community-viewport.md` defers a real
friend feature whose mechanism is a "wormhole" that *moves the camera* to a
friend's neighbourhood without touching either user's placement or backbone
connections. That language — camera movement, not travelling light — stays
available and distinct only if nobody later reaches for the obvious brighter
edge. This decision spends the vocabulary of exchange on the backbone edge, and
the friend feature must use the vocabulary of travel instead.

## Considered and rejected

**Click-burst only, no ambient traffic.** Preserves the paint-on-demand canvas
and confines the dramatisation to a gesture the visitor chose. Rejected because a
4px dot on a canvas that advertises nothing is not discoverable, so in practice
the feature would ship to nobody and the landing page would stay inert.

**Carrying the artboard's `INSIGHTS` payload.** The export gives each signal a
course code and a line of advice (:620). Rejected: it is invented review text,
which is the production mock data #134 forbids and #68 deleted the newsletter
for. It is also vestigial in the export itself — `closeCard()` and
`scheduleClose()` (:1400-1402) are empty stubs and nothing ever draws the note —
so a signal that carries nothing is faithful to the artboard as shipped. Real
review prose on an unauthenticated page is a privacy question, and a separate
one.

**Porting the export's `Math.random()` sampling.** The artboard seeds drift from
a stable per-node hash but samples spawn, speed and the relay coin from
`Math.random()`. We seed all of it from node and edge identity, so the engine is
a pure function of the view and elapsed time. This is a deliberate improvement,
not an accident of translation: it is what makes the traffic assertable in a
test, reproducible across a reprojection, and quotable in a bug report.
