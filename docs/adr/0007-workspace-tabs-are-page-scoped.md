# 7. Workspace tabs belong to the page they were opened on, and are still persisted

Date: 2026-09-06

## Status

Accepted. Settles Part 1 of #201.

## Context

The workspace pane is the column Explore and Saved mount beside their results,
and since #68 §5 retired `/course/<code>` it is the only surface a course opens
in. Both pages host it, and both read their open list through
`useWorkspacePane`.

That list was kept under a single `sessionStorage` key, `cc.workspace.open`.
Navigating Explore → Saved unmounts one host and mounts the other, which
rehydrates the *same* list — so tabs opened while searching appeared in Saved,
and tabs opened from a collection appeared in Explore. Neither page had asked
for the other's work.

A future reader will find a per-route storage key sitting beside artboards that
persist nothing at all, and will reasonably wonder why we did not simply drop
persistence and match the design. This records the three-way trade-off, because
the answer is only inferable today from a long comment in
`workspace-storage.ts`.

### What the design says

The artboards are unambiguous, and they say two things rather than one.

**A tab belongs to one page.** `Course Community - Explore.dc.html:387` and
`Course Community - Saved.dc.html:276` each declare their own `tabs: []` in
local component state. `cc-store.js` — the store the two artboards genuinely
share, and which does carry saved courses and collections across pages — has no
tab state at all.

**Nothing is persisted.** Those `tabs: []` are component state and start empty
on every mount.

A note for anyone reading the artboard source, because it is easy to misread:
`closeAll()` in both files closes **popup menus** (`compareMenu`, `takenMenu`,
`overflowOpen`), not tabs. The Explore artboard's
`onOpen: () => { this.closeAll(); this.openTab(...) }` is "dismiss any open
menu, then open the tab" — it is not tab replacement.

### What persistence is for

`AuthReasonDialog` tells a reader *"Your draft is held as it is — text, ratings
and the course all stay put"*. Signing in is a redirect: the page navigates away
and comes back, and everything in React state goes with it. The whole of
`workspace-storage.ts` exists to keep that promise across it, and the open list
is half of what the sentence names — a draft that survived into a pane with no
tab to appear in would not be the promise being kept.

## Decision

**Scope the key, keep the persistence.** The two are independent, so we take
both.

- `WorkspaceScope` is `"explore" | "saved"`, a domain type in
  `features/workspace/lib/open-courses.ts`.
- The key becomes `cc.workspace.open.<scope>`.
- Explore → Saved shows no tabs. Saved → Explore brings Explore's tabs back.
- Sign-in still returns a reader to their tabs, because the redirect returns to
  the **same route** and therefore to the same scope.

"Living within Explore" is a statement about scope, not about forgetting. A
reader who ducks into Saved and comes back to a lost review draft would be the
worse surprise of the two, and it is the one we have a written promise about.

**The scope is an explicit parameter, not `usePathname()`.** The hook stays
pure and testable, the host goes on owning its own state — which is the existing
shape, argued in the hook's own doc comment — and nothing in the workspace
feature learns what a route is.

**The legacy key is ignored: never read, never written again.** A reader
mid-upgrade holds a shared list under the bare `cc.workspace.open`; it expires
with their session.

This deliberately does *not* follow the precedent of `adoptLegacyDrafts` in the
same file. That function migrates **drafts**, because losing unpublished writing
is real damage and no owner was recorded to restore them to. An open tab is one
click to restore, and adopting a shared list into one page would recreate
exactly the leak this change removes — the migration would be the bug.

## Consequences

- `useWorkspacePane` takes a required argument. There are exactly two callers,
  `explore.tsx` and `saved.tsx`, and a third host would have to name its own
  scope rather than inherit one by accident. That is the point.
- The union has two members and adding a third is a real decision, not a
  formality: a new host either owns its own tabs or deliberately shares another
  page's, and the type is where that gets argued.
- Two pages can now hold two open lists at once in one tab, so a reader may have
  up to twice as many tabs stored. They are three fields each and expire with
  the session; this is not a budget worth managing.
- `?open=` is unaffected. `/course/<code>` redirects to `/search?open=…` and
  opens in Explore; Collections navigates to `/saved?open=…` and opens in Saved.
  Each lands on the route that owns that tab, which was already true and is now
  true for a reason rather than by coincidence.
- The Strict Mode guards in `use-workspace-pane.ts` — the `read` ref and the
  `hydrated` state — are untouched. They solve effect replay, are documented at
  length there, and scoping does not interact with either. A host's scope is a
  literal that never changes for the life of the mount, which is what makes the
  read guard's "once per mount, ever" still correct.
