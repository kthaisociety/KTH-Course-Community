# 8. Saved's narrow band carries the collections row, and both section headings come out

Date: 2026-09-07

## Status

Accepted. Settles #208, and replaces one piece of #205 (ADR 0007's PR) without
disturbing the rest of it.

## Context

Explore and Saved put the workspace pane in the same place, and readers move
between them constantly. #205 made their two tab strips start on the same line
by giving Saved a **blank reservation**:

```
apps/web/features/saved/components/saved.tsx
  @3xl:pt-[var(--cc-search-block-h)]
```

74px of deliberate empty on every Saved page view, held so that the strips agree.
It worked, and it was always a placeholder for something better: Saved has real
furniture that wants to live at exactly that height.

The shape the two pages are meant to share:

```
PageHeader (title + subtitle)
narrow band          ← Explore: the search bar + school filter
                       Saved:   the collections chip row + "New collection"
row (results + pane) ← the tab strips start here, level across both pages
```

So Explore and Saved differ only by title, subtitle, and what sits in the band.

A future reader will find Saved's band styled unlike Explore's — no rail
correction, a different alignment — and a `CollectionChip` that is 42px where its
own artboard says 40, and two artboard headings simply absent. Each of those is
deliberate. This records why, because the reasons are not inferable from the
markup.

### The numbers, measured rather than derived

#208 required this be checked against a running page rather than computed from
Tailwind classes. On a 1920px viewport, signed in, pane open:

| | Explore | Saved (before) | Saved (after) |
|---|---|---|---|
| topbar | 0→66 | 0→66 | 0→66 |
| `PageHeader` | 66→155 (**89px**, not the estimated ~86) | 66→155 | 66→155 |
| band | 155→229 (`<search>`, 74px) | 155→229 (74px **blank**) | 155→229 (74px **of chips**) |
| **workspace tab strip** | **229** | **229** | **229** |
| row box | 490→1666 | 490→1666 | 490→1666 |
| band box | 490→1430 | — | 490→1666 |

The chip measured 94×40 before and 94×42 after; the "New collection" button
135×40 before and 135×42 after, moved from the left of the row to the right.

## Decision

### 1. The band fills the height it used to reserve

`--cc-search-block-h` keeps its value and its derivation from the Explore
artboard. What changes is its meaning: it was "the height Explore spends and
Saved holds blank", and it is now **"the height of the band"** on both pages.

The fixed height stays gated on `@3xl`, which is `WorkspacePaneHost`'s own
condition — but the **band itself is not gated**, which is the change from #205.
It carries the create button and the reader's collections now, and those have to
be reachable on a phone. Below `@3xl` it takes its natural height, which with one
42px row of controls and `18px`/`14px` padding is also 74px.

### 2. The chips scroll sideways; they never wrap

This was the sharpest risk in #208, and it is a real one: the band's height is
the entire levelling mechanism, so anything that can change that height can
re-break the alignment. A `flex-wrap` row does exactly that once a reader has
enough collections — the same defect, re-triggered by user data instead of by
page.

So the chips live in a `flex-nowrap` scroller with `overflow-x-auto` and the
existing `scrollbar-hidden` idiom. Height becomes independent of width, and the
chips stay tabbable. Verified in the browser at 15 chips — 2908px of content in a
973px scroller — with the band still 74px and the tab strips still at 229.

The scroller's right edge fades to `--cc-pg`, the token, never a literal: a
hardcoded white inverts in dark mode. Confirmed to resolve to `rgb(250,248,241)`
light and `rgb(7,24,49)` dark.

### 3. "New collection" is pinned right, outside the scroller

It used to render *before* the chips. The band is meant to read as the same
furniture as Taken's — content on the left, the page's one action pinned right:

```
Taken:  │ 24 courses                          [⟳ Update transcript] │
Saved:  │ [Year 1] [Kandidat] [ML] [Exchange] … [+ New collection]  │
```

### 4. The band's controls are 42px, not the chip's own 40

A deviation from `Course Community - Collections.dc.html`, which draws the chip
at 40. #208's body reconciles the 2px against Explore's 42px search bar by
absorbing it into band padding; it is spent on the controls instead, so that
"the same height as the search bar" is literally true rather than nearly true.
The band is 74px either way — this only decides where the 2px goes.

### 5. Saved's band does **not** take the rail correction

Explore's band carries `@3xl:mr-[236px]`; this one must not, and the reason is
that the margin does two different things to two different bands.

Explore's band is **centred**, so a right margin of a rail width (236px, the
rail's own) moves its bar onto the *viewport's* centre line — measured x-centre
960 on a 1920px viewport. Saved's band is **left-aligned**: chips from the left,
button pinned right. The same margin would centre nothing there and would only
shorten the band by 236px, when the two bands are meant to occupy the same box.

This is the Saved artboard's `savedTopMargin`
(`Course Community - Saved.dc.html:80`) arriving on its own terms, now that there
is finally a band above the row for it to act on — and the answer is the same one
already recorded at `saved.tsx`: the artboard shortens a left-aligned block, and
shortening is not what this band wants.

### 6. The chips move up; the detail does not

`saved.tsx` has recorded since it was built that a fixed-height block above the
workspace row clips a long open collection, because that row owns the page's only
scroll. That has not changed. So this is a **split**, not a reversal: the chips
move into the band, where the artboard always had them, and an open collection's
detail stays in the scrolling column.

The chips **persist while a detail is open**, with the open one marked — they are
the design's only way into collections, so they stay as navigation rather than
being replaced by a back control. `CollectionChip` gains an `active` variant for
it: `aria-current="true"` on its own button, and the app's existing selected
idiom — `--cc-checked-tint` under a `--cc-brand` border — rather than a new one.

### 7. The confirmation note stays in the scroll column

The "collection created/deleted" strip lives for 3 seconds. In the band it would
resize the band for its lifetime and shift both pages' tab strips with it. It
goes above the list instead.

### 8. Both `h2`s come out, and both sections take an `aria-label`

The `Collections` heading with its subtitle, and Saved's own "Saved courses"
heading with its line.

The reason is alignment, and it is stronger than "the page reads fine without
them". Explore has no heading between its band and its results, so any heading
Saved keeps above its list pushes that list down and the two pages stop matching
one row *below* the band as well as at it. Levelling the tab strips and then
leaving a heading in the results column fixes one row and breaks the next.

`COMPACT_HEADING_ID` and `SAVED_HEADING_ID` are both gone; each section is named
with `aria-label` instead, so neither region loses its accessible name. The `h1`
and its subtitle carry the page on both routes.

### 9. A visitor's band is one line

The signed-out card was three rows and about 120px. Left in a band that levels
two pages it would have put a visitor's strips 46px out of step with Explore's —
on a page Explore does not mirror, so nothing would correct it.

```
│ 🔒 Organize your saved courses into collections.        [Sign up] [Log in] │
```

Both entry points are kept. The sync promise — "…and sync across devices" — is
**dropped**, knowingly: one line has no room for it and signing up is one click
away. Measured at 42px inside the 74px band, with the row still at 229.

### 10. The feature splits into a hook and two presentational parts

The chips and the detail are now in different parts of the tree, so `Collections`
cannot be one instance — and it cannot be two, because it owns `?collection=` and
calls `router.replace`; two of those would be two writers on one URL, which is
the render-loop class of bug this repo has been bitten by before.

So:

- `useCollectionsState` holds everything the halves share — the query, the
  mutations, `openId` + routing, the dialog, `pendingDelete`, the note, auth.
  **One call per page.**
- `CollectionsStrip` (band) and `CollectionsBody` (column) are presentational and
  take that one state object.
- `/collections` calls the hook and renders the **body only**. That route has no
  chip strip and never did: `compact` selected between two presentations of one
  list — chips for Saved, 150px tiles for the page — and the tiles are in the
  body, unchanged.
- Saved reads `openId` off the hook, so `onDetailChange` is gone.

No context, no portals, no second router writer, no duplicated mutation logic.

## Consequences

**The token is now load-bearing on both pages in the same way.** Before, Explore
spent it and Saved held it; either could have been edited to a literal and only
one page would have looked wrong. Now both pages read it as a height, and
`explore.spec.tsx` and `saved.spec.tsx` each pin their side to the token.

**The band's height is a page invariant, and it is easy to break by accident.**
Anything added to the band must not be able to change its height: not a wrapping
row, not a transient note, not a taller signed-out state. Three of the decisions
above exist only to protect that, and `saved.spec.tsx` holds each of them.

**`compact` is gone as a prop.** Anything that rendered `<Collections compact />`
now renders a strip and a body from one hook call. The specs that used the prop
use a `SavedEmbedding` harness that wires the two the way the real page does.

**Two artboard headings are now absent from the built page.** A reader comparing
the app to `docs/design_ref/2026-09-06/` will see the difference immediately; §8
is the record of why, and `saved.tsx`'s own header repeats it.

**`/collections` is unaffected in what it draws.** It keeps its `h1`, its
subtitle, its 150px tiles and its full signed-out card. Verified: tiles render at
150px, opening one shows the detail and writes `?collection=` to the URL.

## Verification

Measured against a running dev server on clean page loads, not derived from
source. Both pages' workspace tab strips: **y=229**, before and after, signed in,
pane open. Band height 74px on both. Chip overflow at 15 chips: band unchanged.
Signed-out row: 42px inside 74px. Dark mode: fade and active chip both resolve
through tokens.

One caution for whoever measures next: Next's HMR produced **stale computed
styles and a stale URL** in this session more than once — an element carrying the
right classes while `getComputedStyle` reported the previous ones. Every number
above was retaken after a full navigation. Measure on a clean load, or measure
nothing.
