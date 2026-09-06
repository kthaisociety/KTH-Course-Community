# Cross-route audit ledger — issue #134

**Base SHA:** `1e09ea574d549a84c92990a81bf8d5443a559039` (`origin/feat/frontend`, tip at
branch time and unmoved through the audit).
**Branch:** `feat/recon-audit2`.
**Date:** 2026-09-05.

## Mandate

This pass is **audit only**, per the product owner's comment "This audit is AUDIT
ONLY" on #134 (2026-09-05), which revokes step 2 of that issue's
"Implementation and PR workflow" and its "safe reconciliation fixes in one PR"
deliverable. Nothing in the application was changed. Every defect below is
recorded rather than repaired: the defect, its root cause, the file and line,
what the fix would be, and the confidence behind the claim.

The only files this branch adds are this ledger and the follow-up issues it
links. The diff contains no `.ts`, `.tsx`, `.css` or configuration change.

## Confidence key

Each finding carries a confidence rating for the *claim*, not for the fix.

- **High** — read directly off the code, or off the artboard and the code side
  by side. No inference.
- **Medium** — the code says this and the reasoning is short, but it depends on
  a runtime behaviour I did not execute (a breakpoint, an animation frame, a
  provider's internals).
- **Low** — a suspicion worth recording so it is not lost. Stated as such.

## Severity key

- **S1** — a reader loses data, or reaches a dead end with no way out.
- **S2** — a control does nothing, or does something other than what it says.
- **S3** — visible divergence from the artboard, or a parity gap between
  desktop and mobile.
- **S4** — dead code, unread fields, documentation drift. No user-visible effect.

## Gates

Run from the repository root in the audit worktree, with
`export PATH="$PATH:/c/Users/harri/.bun/bin"`.

| Gate | Baseline at `1e09ea5` | At audit end | Verdict |
|---|---|---|---|
| `bun run lint` | 400 files, 8 warnings | 400 files, 8 warnings | unchanged |
| `bun run typecheck` | exit 0 | exit 0 | unchanged |
| `bun run test:web` | 843 passed / 70 files | 843 passed / 70 files | unchanged |

The 8 lint warnings are the known baseline: unused Drizzle imports in the schema
and four other pre-existing suggestions. No test OOMed; the run completed in
37s with `Exited with code 0`, so this is a genuine pass and not the
"green report that OOMs" failure mode #134 warns about.

Because this pass changes no code, the gates are a control rather than a
verification: identical numbers at both ends confirm the environment, not the
work.

---

# Route 1 — Landing (`/`)

**Artboard:** `docs/design_ref_new/Course Community - Landing.dc.html` (1607 lines).
**Files inspected:** `apps/web/app/page.tsx`, `apps/web/app/layout.tsx`,
`features/landing/components/landing.tsx`,
`features/landing/components/hero-network.tsx`,
`features/landing/components/find-your-dot.tsx`,
`features/landing/api/queries.ts`,
`features/landing/lib/neighbourhood-view.ts`,
`features/landing/lib/hero-keepout.ts`,
`features/shell/lib/search-morph.ts`,
`features/shell/components/search-morph.tsx`.

## Control inventory

| Control | Desktop | Mobile (`@max-lg`) | Same handler? |
|---|---|---|---|
| Wordmark → `/` | `Link` | identical | yes, one element |
| Theme toggle | `ThemeToggle` | identical | yes |
| Log in / Sign up (header) | shown | **hidden** (`hidden … @lg:flex`) | n/a — see below |
| Log in / Sign up (foot card) | **hidden** (`@lg:hidden`) | shown | same `setAuthReason` |
| Account chip + Log out | shown, label hidden under `@lg` | chip shown, label hidden | same `useLogout` |
| Search submit (Enter) | `submitSearch` | identical | yes |
| "Try" chips ×3 | `submitSearch(term)` | identical | yes |
| "Find your dot." | opens `FindYourDot` | identical | yes |
| `FindYourDot` email form | `authClient.signIn.magicLink` | identical | yes, one component |
| `AuthReasonDialog` | shared | shared | yes |

The signed-out header pair and the foot card are the artboard's own responsive
split, not a parity gap: they are two presentations of one `setAuthReason` call,
and every breakpoint reaches one of them. Recorded as satisfied.

## Findings

### L-01 — #127 §5 copy fix has landed, and is an authorised deviation — **satisfied**

**Requirement:** #127 §5, `landing.tsx:35` reads "Open as many courses as you
like side by side", which promises a multi-column comparison the pane does not
do.

The line now reads *"Filter by school, credits or rating. Open as many courses
as you like, each a tab in the pane beside your results."*
(`features/landing/components/landing.tsx`, `SECTIONS[0].body`).

The artboard still says *"…side by side"* — I grepped it directly:
`Course Community - Landing.dc.html` carries the original sentence. So this is a
**live divergence from the artboard**, and it is the correct one: the design
governs copy, but `Course Community - Workspace Pane.dc.html` draws a single
active tab with an "All open panes" overflow, so the two artboards contradict
each other and the behaviour side wins. The deviation is documented in a comment
above `SECTIONS`. **Confidence: high.**

### L-02 — landing → Explore morph is built as specified — **satisfied**

**Requirement:** #68's newest comment, "The landing → Explore transition is the
one place we improve on the artboard", plus #127 §4.

Every non-negotiable is met, verified line by line:

- **Framer Motion, one name.** `apps/web/package.json` now carries only
  `"motion": "^12.38.0"`; `framer-motion` has been removed. Both importers
  (`landing.tsx:4`, `search-morph.tsx:3`) import from `motion/react`. The "two
  names for one library in the manifest" item is closed. **Confidence: high.**
- **FLIP, not `layoutId`.** `features/shell/lib/search-morph.ts` stashes the
  rect under `cc:searchHandoff` — the artboard's own key, used by its
  `toExplore()` (line 501) and `pickUpSharedBar()` (line 855).
- **Consumed once.** `takeSearchBarHandoff` removes the key *before* parsing, so
  a malformed or stale rect is still consumed. The age bound is the artboard's
  own 4000ms, and a negative age (the clock moved between pages) is rejected the
  same way a stale one is.
- **Direct arrival animates nothing.** `useSearchBarArrival` returns before any
  measurement when there is no handoff, so a bookmark, a shared link or the rail
  gets no animation.
- **`prefers-reduced-motion` skips it** on both ends — `submitSearch` falls back
  to `router.push` after `clearSearchBarHandoff()`, and `useSearchBarArrival`
  returns after consuming.
- **One spring, two elements.** `arrival` is a single motion value; the bar's
  `dx/dy` and the rail's `-railWidth` are both read off it. The horizontal
  component is *measured* (`handoff.x - to.left`), never assumed, which is what
  the decision asked for.
- **Hero graph pauses**: `paused={leavingFor !== null}` on `HeroNetwork`.
- **`data-hero-clear` is not reused as the exit selector.** The `<form>` carries
  the attribute for the graph's keep-out and carries *no* `variants`, so variant
  propagation leaves it standing. This is the specific trap the decision named,
  and it is avoided deliberately with a comment saying so.
- **Prefetch on focus** — and also `onPointerEnter`/`onFocus` on each "Try"
  chip, which is a real improvement on the brief: a chip is a one-click submit
  that never focuses the field, so focus alone would leave that path cold.
- **Navigation is driven by the exit completing**, not a timer.
  `EXIT_FALLBACK_MS = 600` is a floor under it, not the driver, and a
  `visibilitychange` handler covers a backgrounded tab where
  `requestAnimationFrame` is throttled to nothing. All three routes funnel
  through one `navigatedRef` guard, and the page's unmount tears down both.

**Confidence: high** on the code; **medium** that it *feels* right, since I did
not run a browser.

### L-03 — Strict Mode double-mount on the handoff read is handled correctly — **satisfied**

This is the exact failure class #134 told me to hunt: a destructive read guarded
by a ref that also guards an animation.

`search-morph.tsx` splits the two deliberately. `taken` is a
`useRef<SearchBarHandoff | null | undefined>(undefined)` that **caches** the
consumed rect rather than recording that a read happened. The layout effect
reads once (`if (taken.current === undefined)`) but the *animation* re-derives
from the cached value on every run. Under Strict Mode's run → cleanup → run
replay, pass 1 consumes the rect and starts the spring, the cleanup stops and
settles it, and pass 2 finds the same rect still in the ref and replays the
arrival. A single "already spent" boolean would have produced no arrival at all
in exactly the development build where someone would look at it.

I checked the other six `useRef(false)` guards in `features/` for the same
pattern. `taken-courses.tsx:221` (`hasReadArrival`) is the only other
ref-guarded destructive read, and it is safe for a different reason: what it
guards is a `setState`, and state survives the Strict Mode effect replay because
the component instance is not remounted. **Confidence: high.**

### L-04 — render-loop hunt: all four candidate effects are guarded — **satisfied**

#134 names unbounded render loops as this codebase's signature defect, twice
manifesting as `Ineffective mark-compacts near heap limit` alongside a
zero-failure test report. I grepped every effect dependency array in
`features/`, `components/` and `app/` for `router`, `searchParams`, `setParams`
or anything derived from them. Four hits, all guarded:

| Site | Dependency risk | Guard |
|---|---|---|
| `features/landing/components/landing.tsx:156` | `[arrivedFromLink, router]` | body is a no-op unless `arrivedFromLink !== null`, and `router.replace("/")` removes it, so it converges after one run |
| `features/saved/components/saved.tsx:179` | `[requestedCode, requestedKind, openTab, router, openCollectionId]` | `spentRequest` ref keyed on `kind:code`, cleared when the request goes |
| `features/search/hooks/use-explore.ts:227` | `[requestedCode, requestedKind, setParams]` — `setParams` is rebuilt on every URL change | `spentRequest` ref, same shape |
| `features/taken/components/taken-courses.tsx:260` | `[router]` | `hasReadArrival` ref, runs at most once per mount |

All four carry comments naming the OOM crash as the reason. `use-explore.ts`
additionally holds the host's handler in its own ref (`openHandler`) so that
Explore passing an inline arrow does not re-fire the open. Each comment states
the real invariant — *"Next's `router` is stable in practice; nothing promises
it, and a test double is not"* — rather than relying on the stability, which is
the right way round. **Confidence: high.**

I also checked the third named pattern, non-idempotent `openCourse`. It is still
non-idempotent (see W-02), but every consumer now guards the call site rather
than relying on the state layer, so it no longer closes a loop.

### L-05 — the hero graph draws the real community — **satisfied**

#68 decision 1 retired the synthetic Halton field. `landing.tsx` now calls
`useNeighbourhood(!sessionPending && signedIn)` and
`usePublicWindow(!sessionPending && (!signedIn || neighbourhood.isError))`, and
`heroWindow` prefers the member read, falls back to the public window, and
otherwise passes `null`. `HeroNetwork`'s `draw()` returns early on a null view
with the comment *"there is nothing here that may invent a node to fill the
frame"* — the honest empty state the decision required.

`Find your dot` no longer swaps the field: `labelled={dotOpen && status ===
"placed"}` only labels a node already on the canvas.

The pre-audit finding filed on #134 — "Landing graph is decorative by default
and feat/frontend lacks dev account placement" — is **closed by work that has
since landed**, and I record it as closed rather than outstanding, per the
brief's instruction to verify against the code rather than trust the issue text.
**Confidence: high** for the client half. The server half (`joinCommunityGraphOnSignUp`,
the self-repair on first read) is `server/**` and out of scope; I did not verify
it and say so rather than implying I did.

### L-06 — `FindYourDot` deviates from the artboard's private-link channel — **intentional deviation, documented**

The artboard mocks a private link that reveals a dot *without signing anybody
in*, plus two "Prototype — simulate the link" buttons. No such channel exists
and nothing in `server/` could answer it. The implementation substitutes Better
Auth's magic link, which signs the member in and returns to `/?dot=1`, and the
reveal then runs against `graph.neighbourhood` for real. The prototype buttons
go with the prototype.

This is the correct call under #68's precedence rule and it is documented in the
component's own header. Recorded as an intentional deviation, not a defect.
**Confidence: high.**

The panel's own async hygiene is worth recording as satisfied too: `submission`
is a monotonic ref, so a send that is still in flight when the panel closes or
when a second address is submitted cannot land and tell the reader "Check your
inbox" over an address they abandoned. The button re-enables in `finally`, so a
rejected request does not strand "Sending…" over an unusable form.

### L-07 — hero canvas does not repaint on a `devicePixelRatio` change — **defect; deferred item 1 confirmed still open**

**Severity: S3.** **Confidence: high** on the mechanism, **medium** on how often
a reader hits it.

`features/landing/components/hero-network.tsx:178`, inside `resize()`:

```ts
const dpr = Math.min(2, window.devicePixelRatio || 1);
if (w === scene.w && h === scene.h && dpr === scene.dpr) return;
```

The scene *compares* DPR, so a relayout would pick a change up — but nothing
schedules a relayout when only the DPR changes. The watchers in that effect are
a `ResizeObserver` on the canvas parent, a `window.resize` fallback,
`visibilitychange`, a `MutationObserver` for the theme class,
`document.fonts.ready`, and a `prefers-reduced-motion` media listener. Dragging
the window to a monitor with a different scale factor can leave the CSS box
identical, so neither observer fires and the canvas keeps a backing store sized
for the old ratio — a blurry or over-sharp graph until something else forces a
resize.

**Root cause:** DPR has no change event. The standard watch is
`matchMedia("(resolution: <n>dppx)")`, which must be **re-armed on every fire**
because the query string embeds the ratio it was created with — which is
presumably why it was deferred rather than done in passing.

**What the fix would be:** in the same effect that owns the other watchers, arm
a `matchMedia` query built from the current `devicePixelRatio`; in its `change`
handler call `relayout()` and then re-arm against the new ratio; tear the
current listener down in the effect cleanup. Roughly ten lines, no API change,
no test-visible behaviour change without a DPR-mocking harness.

**Remaining risk:** low. Cosmetic, transient, and self-corrects on the next
genuine resize.

### L-08 — Suspense tripwire on the morph is latent, not active — **follow-up filed**

**Severity: S3 if it ever trips.** **Confidence: high** on the mechanism and
**high** that it is latent today.

`app/(service)/search/page.tsx` wraps `<Explore />` in `<Suspense
fallback={null}>` (needed for `useSearchParams` prerendering). The rail lives in
`AppShell`, in the `(service)` layout, *outside* that boundary.
`useSearchBarArrival` runs in Explore's `useLayoutEffect`.

So the morph silently assumes the layout and Explore commit in the same pass. If
anything inside Explore ever suspends on first render, the rail commits and
paints at rest first; Explore then commits, and the layout effect yanks the rail
to `translate3d(-railWidth, 0, 0)` and slides it back in — the rail visibly
jumps left before arriving, which is worse than no animation. The 4s handoff
bound would not save it; a suspended first render is well inside 4s.

**Why it does not happen today:** I grepped the whole app for `useSuspenseQuery`
— zero hits. Every query is `useQuery`, which returns a pending state rather
than throwing a promise. The only `Suspense` boundaries in the app are the two
route files, and their children do not suspend.

**Root cause:** an ordering invariant between two React subtrees, with no
mechanism enforcing it and no test asserting it.

**What the fix would be:** not a behavioural change today. Either (a) a
regression test that renders Explore inside a boundary that suspends on first
render and asserts the rail is never transformed, or (b) a comment on
`useSearchBarArrival` recording the invariant so whoever introduces the first
`useSuspenseQuery` finds it. Both, ideally. Follow-up filed.

### L-09 — reduced-motion first render — **low; recorded, not filed**

**Confidence: low.** `useReducedMotion()` may return `null` before it resolves.
`submitSearch` tests `if (reduceMotion || !from?.width …)`, and `null` is falsy,
so a submit inside that window would take the animated path. In practice Motion
resolves this synchronously from `matchMedia` on the client and a submit
requires a user gesture after hydration, so I could not construct a real case.
Recorded so it is not lost rather than filed as a defect.
---

# Route 2 — Explore (`/search`)

**Artboard:** `docs/design_ref_new/Course Community - Explore.dc.html` (1662 lines).
**Files inspected:** `apps/web/app/(service)/search/page.tsx`,
`features/search/components/explore.tsx`,
`features/search/hooks/use-explore.ts`,
`features/search/hooks/use-debounced-query.ts`,
`features/search/api/queries.ts`.

## Control inventory

| Control | Desktop | Mobile | Same handler? |
|---|---|---|---|
| Search field | `onQueryChange`, 300ms debounce | identical | yes |
| Submit (Enter) | `onSubmit` → skips debounce | identical | yes |
| "Clear search" | `onClearQuery` | identical | yes |
| School `<select>` | `onDepartmentChange` → `?department=` | identical, native select | yes |
| Minimum rating `<select>` | `onMinRatingChange` → `?rating=` | identical | yes |
| "Clear filters" | `onClearFilters` | identical, conditional on `hasFilters` | yes |
| `StartHere` suggestion chips ×3 | `onSuggestQuery` | identical | yes |
| Empty-state "clear the search" | `onClearQuery` | identical | yes |
| Error "Try again" | `onRetry` → `search.refetch()` | identical | yes |
| Card "open" | `workspace.open(code, "details")` | identical | yes |
| Card "Write a review" | `workspace.open(code, "review")` | identical | yes |
| Workspace surface | `WorkspacePaneHost` (column) | `MobileWorkspaceSheetHost` (sheet) | same `useWorkspacePane` state, see E-05 |
| `AuthReasonDialog` | one per page | identical | yes |

Both workspace presentations are driven from the *same* `useWorkspacePane()`
instance and the same `workspace.open` / `workspace.close` callbacks, and are
mutually exclusive (`presentation === "sheet" ? … : …`). So the acceptance
criterion "Explore mobile workspace uses the same API-backed panels and actions
as the desktop pane" is met at the data layer: mobile mounts the *same*
`WorkspacePane` component, with the same `CourseDetailsPanel` and
`ReviewDraftPanel` inside it. The gap is in tab navigation only — E-05.

## States exercised

| State | Rendered by | Verdict |
|---|---|---|
| No query | `StartHere` panel, 3 suggestion chips | satisfied — see E-03 |
| Loading, first page | `ResultsSkeleton` ×3 | satisfied |
| Loading, refetch | previous results stay (`keepPreviousData`), label says "Loading courses…" | satisfied; `isLoading: search.isFetching` is deliberate and correct |
| Empty | dashed `Panel`, "No courses match “…”" | satisfied |
| Error | `ResultsError` + "Try again" | satisfied |
| Signed out | fully browsable; only Save/Take prompt | satisfied |

The live region is mounted unconditionally and says nothing before a search,
rather than appearing with its first message — which is the correct handling for
`aria-live`, since a region that mounts together with its content is announced
unreliably. Recorded as satisfied.

## Findings

### E-01 — the pager stays unbuilt and the deferral cites #148 — **satisfied, confirmed as instructed**

`features/search/components/explore.tsx:45` names the issue explicitly:

> *"The artboard's **pager** (lines 263-265) is not built, and stays unbuilt by
> decision: it is **#148**. `search.courses` accepts a `page` input and ignores
> it, and returns `total: results.length` — the count of what it just returned."*

The citation is present and correct, and no pager exists. I did not propose
building one. **Confidence: high.**

The consequence is handled honestly downstream too: `resultsLabel()` says
*"Showing N courses for “q”"* rather than the artboard's *"12 courses match"*,
because the server cannot answer "how many match" — the department and rating
filters run after the fetch, so the returned set can be shorter than the
matching set. That is the smallest edit that keeps the sentence true, and it is
the same discipline #148 is about.

### E-02 — `WorkspacePane` is mounted — **#127 §3 satisfied**

#127 §3 says *"`WorkspacePane` is exported and tested but **mounted nowhere**"*.
That is no longer true, and per the brief I verified it rather than trusting
either state of the checkbox.

- Explore mounts `WorkspacePaneHost` (wide) or `MobileWorkspaceSheetHost`
  (narrow), `explore.tsx:207` and `:220`.
- Saved mounts the same pair, `saved.tsx` — see route 3.

Both hosts render `WorkspacePane`. `#127 §3` is closed. **Confidence: high.**

### E-03 — three deliberate divergences from the artboard, all sound — **intentional deviation, documented**

Recorded here so the ledger is checkable against the artboard rather than only
against the code.

1. **No pager** — E-01, decision on #68, issue #148.
2. **A filter row the artboard does not draw.** The artboard's search block is
   the field alone; #89 requires filters. They are built in the artboard's own
   control vocabulary (34px pill, `--cc-surface` over `--cc-rule3`) rather than
   inventing a treatment, and they are native `<select>`s — keyboard- and
   screen-reader-correct on every platform with no portal. Sound.
3. **No `searchBarMargin` correction.** The artboard narrows the bar by 236px
   while tabs are open (line 1350) so the field stays centred over the results
   rather than the whole row. Not built, and the stated reason checks out: the
   bar is centred inside `max-w-[560px]`, which is narrower than the results
   column at every width the pane can open at, so there is nothing to correct.
   **Confidence: medium** — I reasoned this from the class names rather than
   measuring in a browser.
4. **`StartHere` replaces the artboard's full-catalogue listing.** The artboard
   can list the whole catalogue because its mock store *is* the catalogue.
   `search.courses` is an embedding search and returns nothing for an empty
   query, so the page would open on a blank column under a search box. This is
   the "render only data the real contracts provide" rule applied correctly.

### E-04 — the URL/field reconciliation is correct, including Back — **satisfied**

`use-explore.ts` keeps the typed value in component state and the *searched*
value in `?q=`, reconciled through a `writtenQuery` ref that records the last
value the hook itself wrote. A `?q=` that differs came from outside — Back,
Forward, or a followed link — and the field adopts it. Without that ref the
mirror would win every argument and silently undo a Back.

`issuedParams` solves a second, subtler race: `router.replace` does not land in
`searchParams` synchronously, so two writes inside that window (a school picked
while the typed query is still in its 300ms debounce) would each build a URL
from the same pre-write snapshot and the later one would drop the other's
parameter. The second write composes on the record instead. This is a real bug
that is already fixed; I record it as satisfied because a ledger of defects only
cannot be told from a ledger that stopped looking. **Confidence: high.**

### E-05 — mobile has no way to switch between open courses without closing one — **defect / product decision required**

**Severity: S3.** **Confidence: high** on the behaviour; **medium** on whether
it is a defect at all, which is why it is also a product decision.

`features/workspace/components/mobile-workspace-sheet-host.tsx:108-113` passes:

```tsx
openCourses={[activeEntry]}
activeId={activeEntry.id}
onActivate={() => undefined}
hideTabs
```

So on a narrow frame:

- The pane is given a **one-entry list**, not the real open list.
- The tab strip and its "All open panes" overflow menu are suppressed by
  `hideTabs`.
- `onActivate` is **inert** — an unreachable no-op, since `hideTabs` removes the
  only two things that could call it.

The consequence: with three courses open on mobile, only the top one is on
screen and the *only* way to reach the second is to **close** the first. Closing
is destructive — it discards that tab — whereas on desktop switching is free.

**What the artboard actually says.** I read
`Course Community - Mobile Preview.dc.html` rather than assuming.
Line 19: *"Tapping a course opens its own sheet from the bottom… **Sheets stack
— open several, dismiss each with the × or by dragging it all the way down.**"*
Line 265 is `<sc-for list="{{ sheets }}">`, and each sheet is absolutely
positioned at its own `bottom: {{ s.bottomOffset }}px` with its own `zIndex`,
importing the Workspace Pane with `hide-tabs="{{ true }}"`.

So the artboard **also has no tab switcher on mobile** — `hideTabs` and the inert
`onActivate` match it, and the pane's `hideTabs` doc comment cites this artboard
note accurately. That half is correct and I record it as satisfied.

**But the artboard renders every sheet, visibly offset into a stack, and the
implementation renders exactly one.** That is the divergence:

- A reader on mobile with three courses open sees no indication that two more
  exist. The artboard's offset stack is the affordance that says so.
- The component's own doc comment claims *"A closed sheet reveals the still-open
  entry beneath it, so several course details and review drafts remain
  available"* — which describes the artboard's stack, not what this code draws.
  Functionally the reveal does happen (`closeCourse` reassigns `activeId`), but
  nothing is "beneath" anything; there is one sheet whose contents change.

**Root cause:** the host collapses the workspace to `active` before rendering
(`openCourses.find(…) ?? openCourses.at(-1)`) and renders a single
`<Sheet>`, instead of mapping the open list to a stack of sheets.

**What the fix would be:** map `openCourses` to one absolutely-positioned sheet
each, `bottom` offset by depth and `z-index` by index, with only the topmost
interactive — which is what the artboard draws. The drag-to-dismiss and × already
exist per sheet. Radix's `Sheet` renders one portal per instance, so this is
more likely a hand-rolled stack container than N `<Sheet>`s; that is the
non-trivial part and the reason it belongs in a fix pass rather than here.

**Why it is also a product decision:** the Mobile Preview artboard labels itself
*"Mobile concept — … **Draft only, does not change the desktop pages.**"* Its
authority is therefore weaker than the other artboards', and shipping one sheet
instead of a stack may be a deliberate simplification nobody wrote down.
**Escalated.**

### E-06 — the mobile sheet adds a titled header the artboard does not draw — **divergence, low**

**Severity: S4.** **Confidence: high.**

The artboard's sheet has no header band: the drag handle sits absolutely at
`top:8px` centred, the × at `top:8px;right:10px`, both overlaying the pane
content. The implementation adds a 48px `bg-cc-info` header carrying the course
label and the ×, and puts the drag handle inside it
(`mobile-workspace-sheet-host.tsx:74-101`).

This is an accessibility-positive change — the sheet gains a visible accessible
name, and the drag target is a real `<button>` with an `aria-label` rather than
a bare `div` with `onPointerDown`. But it is still an unrecorded divergence from
the artboard on a route where the design governs, so it goes in the ledger.
No fix proposed; if it is kept it should be documented as a deviation the way
`FindYourDot`'s is.

### E-07 — `openCourse` is still non-idempotent by object identity — **defect, S4, root cause of a resolved class**

**Severity: S4** today; it was S1 twice. **Confidence: high.**

`features/workspace/lib/open-courses.ts`:

```ts
export function openCourse(workspace, courseCode, kind) {
  const id = openCourseId(courseCode, kind);
  if (workspace.open.some((entry) => entry.id === id)) {
    return { ...workspace, activeId: id };   // ← new object even when nothing changed
  }
  …
}
```

Re-opening the tab that is **already active** returns a structurally identical
but referentially new `Workspace`. `useWorkspacePane` stores it with `setState`,
so React re-renders, `useMemo` rebuilds the returned object, and every host
re-renders. That is the engine behind both historical OOM crashes: pair it with
an effect whose dependency identity is not stable and it never settles.

It is S4 rather than S2 today because every consumer now guards its own call
site (E-04, L-04) — but the guards are four copies of a workaround for one
defect in a pure function, and the fifth consumer will not have one.

**What the fix would be:** one line —

```ts
if (workspace.activeId === id) return workspace;
```

before the spread, inside the already-open branch. Pure, covered by
`open-courses.spec.ts`'s existing suite shape, and it would let the guards
elsewhere become belt-and-braces rather than load-bearing. **Not applied —
audit only.** This is the single highest-value item in the ledger relative to
its size.

### E-08 — `?open=`/`?kind=` contract is forgiving in both directions — **satisfied**

`openCourseRequest` upper-cases the code (so the bookmarked `/course/dd2380`
still works) and treats any non-`review` kind as `details` rather than refusing
the link. Both are the right call for a parameter that is typed by hand as often
as it is followed, and both are documented. The redirect at
`app/(service)/course/[courseCode]/page.tsx` maps `?writeReview=1` onto
`kind=review` and everything else onto `kind=details`, so the retired URL's two
ways in survive as the pane's two kinds of tab. **Confidence: high.**

---

# Cross-route surface — navigation and shell

**Artboards:** `Course Community - Page Header.dc.html` (the whole of it),
`Course Community - Mobile Preview.dc.html`.
**Files inspected:** `features/shell/components/app-shell.tsx`,
`features/shell/components/rail.tsx`,
`features/shell/components/page-header.tsx`,
`features/shell/components/page-column.tsx`,
`features/shell/components/theme-toggle.tsx`,
`features/shell/lib/page-title.ts`, `apps/web/app/globals.css`,
`apps/web/app/layout.tsx`, `apps/web/components/theme-provider.tsx`.

### N-01 — drawer navigation and route titles at every breakpoint — **satisfied**

The acceptance criterion is *"drawer navigation and route titles remain
accessible at supported breakpoints"*. Verified:

- `AppShell` renders the rail as an `<aside>` that is `hidden … @3xl/shell:block`
  and, below that, a left `Sheet` drawer holding **the same `Rail` component**
  behind a `Menu` button (`aria-label="Open menu"`). Not a second copy — one
  component, two mounts, so no divergent local state. The drawer's `Rail` also
  gets `onDismiss`, which the inline one does not need.
- The drawer has a `SheetTitle` (`sr-only`, "Menu"), so it is named for a
  screen reader.
- Route titles: `PageHeader` is `hidden … @3xl/shell:block`; the topbar `<h1>`
  is `@3xl/shell:hidden`. Exactly one `<h1>` at every width, and the topbar one
  is derived from the pathname by `pageTitleFor`, so it is correct on first
  paint rather than after hydration.
- `PageHeader`'s comment records *why* it uses the named `@3xl/shell` container
  rather than its nearest `PageColumn` container: nested page containers could
  otherwise open a tablet interval with zero — or two — route headings. That is
  a real bug that was reasoned about and avoided.

**Confidence: high.**

### N-02 — the scrollbar convention holds across `features/` and `app/` — **satisfied (this is the product owner's probe)**

`app/globals.css:363-371` documents the convention:

> *"The convention is that a scroll container picks one of these two utilities
> deliberately. Neither is the same as picking nothing… **what this pass
> corrected across ten surfaces**. If you add `overflow-auto` anywhere, add one
> of these with it."*

I enumerated every `overflow-y-auto` / `overflow-x-auto` / `overflow-auto` /
`overflow-scroll` in `features/`, `app/` and `components/`. **All thirteen in
`features/` and `app/` carry a utility** — eleven `scrollbar-subtle`, two
`scrollbar-hidden` (Explore's and Saved's results columns, which is the
documented "deliberate exception, and the only one", justified by the columns
carrying their own scroll affordance).

I record this as the deliberate probe #134 planted, and as **satisfied**.
**Confidence: high.**

### N-03 — four scroll containers outside `features/` still take no utility — **defect the probe pass missed**

**Severity: S4** (S3 on one surface a reader actually reaches).
**Confidence: high.**

The convention in `globals.css` is written unqualified — *"every scroll
container in the app"*, *"if you add `overflow-auto` anywhere"* — but four
containers under `components/` have neither utility:

| File | Line | Container | Reachable? |
|---|---|---|---|
| `apps/web/components/RichEditor.tsx` | 121 | toolbar, `overflow-auto` | **yes** |
| `apps/web/components/RichEditor.tsx` | 145 | editor body, `h-72 overflow-auto` | **yes** |
| `apps/web/components/RichEditor.tsx` | 157 | footer bar, `overflow-auto` | **yes** |
| `apps/web/components/editor/editor-ui/content-editable.tsx` | 19 | `overflow-auto` | via `components/editor/**` |

`RichEditor` is **live production UI**: `features/reviews/components/review.tsx:5`
imports `RichTextEditor` from it, and that dialog is reachable from My Page's
"Edit review" and from `ReviewList`'s inline edit — which is itself rendered
inside the workspace pane's `CourseDetailsPanel`. So a reader editing a review
inside a `cc-theme` dialog gets the browser's default chunky scrollbar on the
editor body, which is exactly what the probe pass set out to remove.

**Root cause:** the corrective pass scoped itself to `features/` and `app/`.
The convention it documented did not.

**What the fix would be:** add `scrollbar-subtle` to those three `RichEditor`
containers and to `content-editable.tsx`. Four class additions, no behaviour
change. The shadcn primitives under `components/ui/**` are a separate question —
they carry their own vocabulary (`no-scrollbar`, `scrollbar-thin`,
`scrollbar-none`) inherited from upstream, and several are unused (see X-02), so
I would leave them alone and say so in the convention comment.

### N-04 — theme handling and the `cc:theme` key migration — **satisfied**

`app/layout.tsx` records three deliberate deviations from the artboards
(`attribute="class"` over `data-cc-theme`; `defaultTheme="system"` with
`enableSystem` over the artboard's light default; `storageKey="cc:theme"`), each
with a reason the artboards have no way to express, and a fourth note on why
`disableTransitionOnChange` is deliberately *not* set — it would kill the
cross-fade `cc-theme` exists to provide.

The Greptile finding from wave 1 ("moving the persisted theme key to `cc:theme`
silently drops a reader's existing preference") is closed:
`components/theme-provider.tsx:27` carries `THEME_KEY_MIGRATION`, a one-time
pre-paint script that copies a valid `theme` value to `cc:theme` only when
`cc:theme` is unset, wrapped in `try/catch` because reading `localStorage`
throws outright where site data is blocked. It runs before `next-themes`' own
pre-paint script, which is why it lives in the provider rather than an effect.
**Confidence: high.**
---

# Route 3 — Saved (`/saved`)

**Artboard:** `docs/design_ref_new/Course Community - Saved.dc.html` (1226 lines),
and `Course Community - Saved copy.dc.html` (identical length; a duplicate export).
**Files inspected:** `apps/web/app/(service)/saved/page.tsx`,
`features/saved/components/saved.tsx`, `features/saved/api/mutations.ts`,
`features/courses/lib/card-geometry.ts`,
`features/workspace/hooks/use-results-width.ts`,
`features/workspace/hooks/use-workspace-presentation.ts`.

## Control inventory

| Control | Desktop | Mobile | Same handler? |
|---|---|---|---|
| Collections strip (compact) | `Collections compact` | identical component | yes |
| Card open | `workspace.open(code,"details")` | identical | yes |
| Card "Write a review" | `workspace.open(code,"review")` | identical | yes |
| Card remove (trash) | `unsave` → `setSaved(code,false)` | identical | yes |
| Collection picker on card | `action="add"` | identical | yes |
| Empty-state "Explore courses" | `router.push("/search")` | identical | yes |
| Workspace surface | `WorkspacePaneHost` | `MobileWorkspaceSheetHost` | same state — see E-05 |

## States exercised

| State | Rendered by | Verdict |
|---|---|---|
| Session loading | 3 × `CardSkeleton` (236px, the artboard's own) | satisfied |
| Empty | "No saved courses yet" + Explore button | satisfied |
| Partial failure | `<output>` note, "N saved courses could not be loaded. They are still saved" | satisfied, and unusually good — see S-02 |
| Detail open | saved list hidden (`openDetail !== null ? null : …`) | satisfied — the artboard's own `showSavedSection` |
| Signed out with stale cookie | `AuthReasonDialog` via the card's prompts | satisfied — see S-04 |

## Findings

### S-01 — the unorganized / all-organized split is still not built — **product decision required, unchanged since #127 §4**

**Severity: S3.** **Confidence: high.**

#127 §4 records this as *"dropped because a course would vanish from `/saved` on
joining a collection, reachable only behind a chip. Needs a product decision,
not just code."* I verified it against the code as it stands, and it is still
deferred, still for that reason, and now documented at length in
`features/saved/components/saved.tsx:70-85`.

What the artboard draws and the code does not:

- Below the chips, only saved courses **not** in a collection (artboard line 128).
- An `h2` reading "Saved courses" over the line *"Courses you have saved but not
  yet added to a collection"*.
- An *"Every saved course is in a collection"* panel when none are left.

What the code does: one flat list of every saved course. The `h2` is dropped too,
on the reasoning that "Saved courses" under an `h1` also reading "Saved courses"
says nothing once the distinguishing subtitle is gone — which is correct as far
as it goes.

**The objection is still valid.** A reader who files everything would land on a
page whose only list is empty, under a heading promising their saved courses,
with every course reachable only by opening the collection holding it.

**What the fix would be — and why it is not mine to pick.** Three shapes, and
they are product choices, not code choices:

1. Build the artboard exactly, and accept that a fully-organized library shows
   an empty list plus the "Every saved course is in a collection" panel. The
   artboard *does* provide that panel, so this is more defensible than #90
   judged.
2. Keep the flat list and drop the split from the design.
3. Flat list with an "organized" affordance — a filter or a badge on cards that
   belong to a collection — so the information the split carries survives
   without removing anything from the page.

**Escalated to the product owner.** This is #127's own "needs a product
decision, not just code", and nothing since has decided it.

### S-02 — partial-load failure is reported rather than swallowed — **satisfied**

Worth recording because it is the kind of state audits usually find missing.
`saved.tsx` computes `unreadable = savedCourseCodes.length - courses.length` and
renders an `<output>` (the element that carries the status role the artboard's
`aria-live` asks for) saying the courses are **still saved**. Critically, a page
where *every* summary failed does not fall through to "No saved courses yet" —
the empty branch keys on `savedCourseCodes.length === 0`, not on
`courses.length`. An empty library and an unreadable one are different pictures
and are drawn differently. **Confidence: high.**

### S-03 — `user.me` is the single source for saved codes — **satisfied**

`saved.tsx` reads `user?.savedCourseCodes` rather than `saved.list`, with the
comment *"A second copy would mean an unsave that empties one and leaves the
other holding the course."* The card's own Save state reads the same query, so
an unsave invalidates one cache and both surfaces agree. This is exactly the
"divergent local state" class #134 asks about, and it has been avoided
deliberately. **Confidence: high.**

### S-04 — the auth gate is honest about `proxy.ts` — **satisfied**

`proxy.ts` (Next 16; not `middleware.ts`) only checks that a session *cookie*
exists for `/profile`, `/saved` and `/taken` — it does not validate it. So a
stale cookie reaches this page signed out. `saved.tsx` calls
`useRequireSession()` and still renders `AuthReasonDialog`, and the card's
controls ask for a session the way they do everywhere else rather than failing
silently. The component carries a comment saying precisely this. The real gate
is `protectedProcedure` on the server. **Confidence: high.**

### S-05 — the card ramp on Saved is measured, and the artboard is followed over #90 — **satisfied**

#90 decided "Saved pins the card's `geo` to the fully collapsed end". That was
decided when this page had no pane to yield to. It has one now, and the artboard
computes `geo` from what the pane leaves of the row (line 844) exactly as
Explore does. `saved.tsx:127-128` uses `courseCardGeometry(resultsWidth)` with
`useResultsWidth()`. Correct, and correctly reasoned in the file's header.
**Confidence: high.**

---

# Route 4 — Collections (`/collections`, and the `compact` section inside `/saved`)

**Artboard:** `docs/design_ref_new/Course Community - Collections.dc.html` (445 lines).
**Files inspected:** `apps/web/app/(service)/collections/page.tsx`,
`features/collections/components/collections.tsx`,
`features/collections/components/collection-detail.tsx`,
`features/collections/components/collection-chip.tsx`,
`features/collections/components/collection-tile.tsx`,
`features/collections/components/new-collection-dialog.tsx`,
`features/collections/components/empty-panel.tsx`,
`features/collections/hooks/use-popover.ts`,
`features/collections/hooks/use-rename-draft.ts`,
`features/collections/lib/collection-model.ts`,
`features/courses/lib/collection-order.ts`.

## Control inventory

| Control | Full page | `compact` (inside Saved) | Same handler? |
|---|---|---|---|
| "New collection" | `EmptyPanel` button / header button | dashed 40px chip, always first in the row | both `setDialogOpen(true)` |
| Open a collection | `CollectionTile` click | `CollectionChip` click (whole chip) | both `openCollection(id)` |
| Rename | tile ⋯ menu → inline input | chip ⋯ menu → inline input | both `onRename`, via `useRenameDraft` |
| Delete | tile ⋯ menu | chip ⋯ menu | both `onDelete` — **see C-01** |
| Detail: back | "All collections" | identical | yes |
| Detail: add course | `usePopover` menu of addable saved codes | identical | yes |
| Detail: remove course | card `removeLabel` button | identical | yes |
| Detail: reorder | ▲ / ▼ per course, ends disabled | identical | `collections.reorder` |
| Detail: delete | "Delete" button | identical | **see C-01** |
| New-collection dialog | name + filter + checkbox list | identical | yes |

`/collections` and the compact section are **one component** with a `compact`
flag, so there is no divergent handler anywhere in this table. Recorded as
satisfied.

## Findings

### C-01 — collection deletion is immediate and irreversible, from three entry points — **product decision required; a #127 requirement reads as unmet**

**Severity: S1** — a reader loses data with no way back.
**Confidence: high.**

#134's inherited requirements list says, verbatim: *"ensure destructive
Collection deletion confirms before mutation"*.

That is not what the code does. Three call sites —
`collection-detail.tsx:186`, `collection-tile.tsx:126`, `collection-chip.tsx:118`
— all reach `collections.tsx:281`:

```ts
function onDelete(collection: Collection) {
  deleteCollection
    .mutateAsync({ collectionId: collection.id })
    .then(() => {
      if (openId === collection.id) openCollection(null);
      showNote(`Collection "${collection.name}" deleted`);
    })
```

The mutation fires **on the click**. There is no dialog, no second click, no
hold-to-confirm. `showNote` is a transient text banner plus an `aria-live`
region — it carries **no Undo**; I read `showNote` and the `note` state at
`collections.tsx:172-182` and `:341-349` to be sure. So the sequence is
delete → tell the reader it happened.

What is lost: the collection and its curation — its name and its stored course
order. The courses themselves survive (`user_saved_courses` has no dependency on
it), so this is not catastrophic, but the ordering work is unrecoverable.

**Why I am escalating rather than calling it a straight defect.** The
implementation is matching the artboard, deliberately and correctly under the
precedence rule. I checked `Course Community - Collections.dc.html` directly:

- line 83 — detail `Delete` → `onDetailDelete`
- line 402-405 — `onDetailDelete: () => { … STORE.deleteCollection(detail.id);
  this.setState({ detail: null, note: "Collection deleted" }) }`
- lines 124 / 163 / 276-279 — the tile and chip menus, same shape.

So the artboard also deletes on the click and shows the note afterwards, with no
confirm and no undo. #127 §4 says exactly this: *"Collection deletion (#91)
confirms *after* rather than *before*. That is the artboard's own behaviour, so
it was followed, but it deletes immediately and irreversibly."*

**This is a genuine conflict between the requirements list and the design
authority**, and the brief is explicit that where they disagree I match the
artboard and report rather than change. So:

- As a **design-conformance** item: **satisfied**, exactly.
- As a **#127 requirement**: **unmet**, and it cannot be met without
  overriding the artboard.

**What the fix would be, if the product owner chooses to override.** Two options,
and the second is better:

1. An `AlertDialog` before the mutation. Costs a modal on a frequent action and
   contradicts the artboard's flow.
2. **Keep the artboard's flow and give the existing note an Undo.** The note
   already exists, already sits where the reader is looking, and already fires
   at the right moment. An undo is expressible in the contracts that exist
   today — no schema work — but it is **three procedures, not two**, and the
   sequence matters:

   1. `collections.create(name)` — returns a collection with **empty**
      `courseCodes`. `server/collections/service.ts:55-65` ends
      `return toCollection(row, [])`, so creating restores the name and
      nothing else.
   2. `collections.addCourse(collectionId, courseCode)` — **once per course**,
      because `reorder` cannot add membership.
      `reorderCollectionCourses` (`:140-166`) reads the current members and
      throws `NotFoundError` for **any** requested code that is not already
      one, so a `create` → `reorder` pair fails outright rather than
      partially working.
   3. `collections.reorder(collectionId, courseCodes)` — last, to restore the
      saved ordering. `addCourse` appends, so order has to be reasserted after
      every member is back.

   **And there is a failure mode the sequence cannot paper over.**
   `addCourseToCollection` (`:97-107`) throws `ForbiddenError`
   — *"Save `<code>` before adding it to a collection"* — when the course is no
   longer in `user_saved_courses`. So an undo attempted after the reader has
   also unsaved one of the courses **cannot fully restore the collection**.
   Whoever implements this has to decide what that partial restore says to the
   reader; it is not a detail that can be left to the happy path.

   This still satisfies "no irreversible destruction" and still keeps the
   artboard's one-click delete. It is simply more work than one line of the
   ledger originally implied.

**Escalated to the product owner.** Recommending option 2.

**Correction, prompted by Greptile on PR #163 (round 1).** An earlier version of
this finding said `collections.create` plus `collections.reorder` could restore
"name, membership and order". That was wrong: `reorder` validates every
requested code against existing membership before writing positions, so it can
never add a member. Greptile reproduced this with an executable test against the
real service, and the recipe above is the corrected one. The `ForbiddenError`
constraint in the last paragraph is a further limit that neither the original
claim nor Greptile's correction mentioned, found while verifying the fix.

### C-02 — the compact chip now matches the revised artboard — **satisfied; #127 §4 item 3 is closed**

**Confidence: high.** This is the item the brief warned would mislead: #127 §4
says *"`Collections`' `compact` chip layout (#91, partly built by #90) — still
not what the artboard draws"*, and reading that as an open defect would be
wrong, because the artboard was revised.

I read the revised artboard rather than trusting the deferral.
`Course Community - Collections.dc.html:106-112` is the `compact` branch:

| Property | Artboard (line 112) | `collection-chip.tsx` | Match |
|---|---|---|---|
| height | `height:40px` | `h-10` | yes |
| padding | `padding:0 12px` | `px-3` | yes |
| gap | `gap:9px` | `gap-[9px]` | yes |
| radius | `border-radius:9px` | `rounded-[9px]` | yes |
| border | `1px solid var(--rule)` | `border border-cc-rule` | yes |
| surface | `background:var(--surface)` | `bg-cc-surface` | yes |
| hover | `border-color:var(--hov)` | `hover:border-cc-hov` | yes |
| whole chip opens | `onClick={{ col.onOpen }}` | absolute inset-0 button | yes |

The dashed "New collection" chip (artboard line 108: `height:40px`, `padding:0 13px`,
`gap:6px`, dashed `#9dbfe4`, `rgba(23,81,166,.06)`) is
`collections.tsx:449-457`: `h-10`, `px-[13px]`, `gap-1.5`, `border-dashed
border-cc-hov`, `bg-cc-info` — the tokenised equivalents of that hex pair, kept
first in the row whether or not any collection exists, which is what the
artboard does. **#127 §4 item 3 is closed.**

### C-03 — `collection-chip.tsx` cites an artboard line that has moved — **defect, S4**

**Severity: S4.** **Confidence: high.**

`features/collections/components/collection-chip.tsx:19` reads:

> *"`Course Community - Collections.dc.html` **line 174** draws this row when the
> artboard is embedded rather than shown as a page"*

Line 174 of the current artboard is the *"No collections yet"* empty panel. The
compact chip row is **line 112**. The comment was written against the earlier
export and the artboard was revised under it.

This is the smaller half of the problem the #127 correction warns about — the
*claim* is still true (the artboard does draw this row when embedded), only the
line number moved. But it is exactly the kind of citation that sends the next
reader to the wrong place, and I checked rather than assumed.

**What the fix would be:** change `line 174` to `line 112`. One character-level
edit. I also checked the repo for stale `docs/design/` and `docs/design_ref_old/`
paths and found **none** — see X-01 — so this is a residue of a different kind.

### C-04 — `CollectionDetail` pins the card geometry, and on `/saved` that is wrong — **defect; deferred item 5 confirmed and sharpened**

**Severity: S3.** **Confidence: medium-high** — the mechanism is read directly
off the code; I did not render it at a narrow width.

`collection-detail.tsx:235` hard-pins every card:

```tsx
geo={EXPANDED_CARD_GEOMETRY}
```

and `:61-62` justifies it:

> *"The geometry is pinned to the expanded end: **the page column has nothing
> competing for its width**, so there is no ramp to interpolate along."*

**That claim is true on `/collections` and false on `/saved`.** Saved embeds
`Collections compact` *inside* `resultsRef` — the very column
`WorkspacePaneHost` narrows, by up to the pane's full width. When a reader has a
workspace tab open on `/saved` and then opens a collection, the collection's
cards render at maximum geometry inside a column that may be several hundred
pixels narrower, and the column is `overflow-x-hidden`, so the surplus is
**clipped rather than scrolled**. Each row also spends ~36px on the ▲/▼ column
before the card starts.

This is deferred item 5 stated precisely: it is not merely that "the same card
behaves differently by which list it is in", it is that one of the two behaviours
is *wrong in a reachable state*.

**Root cause:** the pin was correct when `CollectionDetail` only ever rendered on
the full-width `/collections` route; it was embedded into Saved later and the
assumption in its comment was not revisited.

**What the fix would be:** `CollectionDetail` should take `geo` as a prop, the
way `CourseCardItem` already does. `/collections` passes
`EXPANDED_CARD_GEOMETRY` (its column genuinely has no competition); Saved passes
its own measured `courseCardGeometry(resultsWidth)`, which it already computes at
`saved.tsx:128`. That is a prop-drill of one value through
`Collections` → `CollectionDetail`, no new measurement, and it makes the card
behave identically in both lists. The comment at `:61-62` then belongs on
`/collections`' call site instead.

### C-05 — `card-geometry.ts`'s header now contradicts Saved's — **defect, S4**

**Severity: S4.** **Confidence: high.**

`features/courses/lib/card-geometry.ts:5-7`:

> *"…which is what lets Explore interpolate the whole card from its results
> column as a workspace pane is dragged open, while **Saved and Collections
> simply pin an end of the ramp**."*

Saved does not pin. `saved.tsx:128` is `courseCardGeometry(resultsWidth)`, and
`saved.tsx:47-52` explicitly explains why #90's pinning decision was reversed.
Two comments in the same feature now state opposite things about the same page,
and the geometry module's is the one a newcomer reads first.

**What the fix would be:** amend the sentence to name only `CollectionDetail` as
pinning — and, if C-04 is taken, drop the clause entirely. Documentation only.

### C-06 — "comparison" has not been reintroduced — **satisfied**

#127's requirement: *"preserve settled Collection terminology and do not
reintroduce comparison as a product concept."* I grepped the whole of
`apps/web` for `comparison`/`comparisons`/`hasComparisons`/`onNewComparison`.

The only hits are inside `docs/design_ref_new/*.dc.html` — the artboards'
own mock stores, including `Saved.dc.html:691` and `:706`, which the #127
comment already flagged as *"the design catching up rather than work for us"*.
No repository identifier, fixture field, prop or reader-facing string carries
it. Every hit inside `apps/web` is either a comment explaining the ban or a
**guard test asserting the word is absent** — `collections.spec.tsx:443`,
`course-card.spec.tsx:186`, `landing.spec.tsx:267`, `saved.spec.tsx:171` and
`app-shell.spec.tsx:116`. (`server/search/service.ts:17` uses "comparison" in
its ordinary English sense — comparing two scales — not the product concept.)
So the terminology is not merely correct today, it is held in place by tests. `course-card-model.ts:254-262` records the decision on the one string that
was closest to the line — the card's add button reads "Add to collection", and
the comment explains that the artboards' "Add to comparison" is overridden by
#68 decision 1 because promising a feature in the words a reader sees is the
same error as promising it in an identifier. **Confidence: high.**

### C-07 — `?collection=` round-trips, and `/collections` is kept for the resolver — **satisfied**

`/saved?collection=<id>` is the permalink (the artboard reaches collections only
from Saved, so the permalink is Saved's), and `saved.tsx:120-121` mirrors the
prop into `openDetail` so the route is the authority on first paint and the chips
after. `/collections` survives as the resolver #91 kept deliberately, with the
rail still carrying no link to it — which is #68 decision 5's stated intent, so
its absence from the rail is not an oversight. An id that is not the viewer's own
reads as not-found rather than refused, because ownership is scoped in the query.
**Confidence: high.**
---

# Route 5 — Taken courses (`/taken`), and the Quick Reviewer

**Artboard:** `docs/design_ref_new/Course Community - Taken Courses.dc.html` (1550 lines).
**Files inspected:** `apps/web/app/(service)/taken/page.tsx`,
`features/taken/components/taken-courses.tsx`,
`features/taken/components/taken-course-row.tsx`,
`features/taken/components/add-taken-course-dialog.tsx`,
`features/taken/components/transcript-drop-zone.tsx`,
`features/taken/components/transcript-proposal.tsx`,
`features/taken/api/transcript.ts`, `features/taken/lib/taken-rows.ts`,
`features/reviews/components/reviewer.tsx`,
`features/reviews/components/reviewer-card.tsx`,
`features/reviews/lib/reviewer-session.ts`,
`features/reviews/components/unreviewed-card.tsx`.

## Control inventory

| Control | Desktop | Mobile | Same handler? |
|---|---|---|---|
| Add course by hand | `AddTakenCourseDialog` → `add` | identical | yes |
| Transcript drop zone / Choose a PDF | `uploadTranscript` | identical (file input) | yes |
| "Looks right" (confirm import) | `confirmImport` | identical | yes |
| Cancel import | clears `proposal` | identical | yes |
| Row edit (grade/credits/attendance) | `update` | identical | yes |
| Row remove | `remove` | identical | yes |
| `UnreviewedCard` "Fast track all N" | `openReviewer()` | identical | yes |
| `UnreviewedCard` per-course row | `openReviewer(courseCode)` | identical | yes — **contrast with M-01** |
| Reviewer: Skip for now | `finish(code,"skipped")` | identical | yes |
| Reviewer: save | `useAddReview` | identical | yes |
| Reviewer: Try again after save error | `saveError` retry path | identical | yes |
| Reviewer: Back to courses | `closeReviewer` | identical | yes |
| Done: Go through the skipped ones | rebuilds `order` from skipped | identical | yes |

## Findings

### T-01 — the Quick Reviewer is built as the artboard draws it — **satisfied; #134 pre-audit finding 3 is closed**

The pre-audit comment on #134 says *"Quick Reviewer is only partially
implemented… TakenCourses renders the legacy Review dialog for `reviewQueue[0]`,
and its own source comment explicitly says the bespoke card stack was
intentionally not built."* Per the brief I verified against the code rather than
trusting the issue, and **all of that has since landed**:

- `features/reviews/components/reviewer.tsx` and `reviewer-card.tsx` exist and
  are exported from the reviews barrel as *"The fast-track card stack"*.
- `taken-courses.tsx:523` renders `<Reviewer …>`, replacing the list — the
  artboard's `isReviewer` branch, a screen of the page rather than a dialog over
  it. The legacy `Review` dialog is **not** rendered on this route.
- Every element #68 decision 4 named is present: `Back to courses` (`:203`),
  progress (`:209-218`), peeked cards behind the active one
  (`PEEK_DEPTH`, `:241-248`), `Skip for now` (`:273`), the save-error row with
  `Try again` (`saveError`, `:125`/`:165`), and the done screen with
  `Back to my courses` (`:310`) and `Go through the skipped ones` (`:326`).
- **One write path, two presentations**, as required: the reviewer maps a card
  onto `ReviewFormData` and hands it to `useAddReview` — the same hook the
  workspace pane's `ReviewDraftPanel` and the `Review` dialog use, and the one
  place `reviewFormSchema` runs.
- **My Page's deep link is honoured.** `/taken?review=1` is read on arrival and
  `router.replace("/taken")` takes it back out, so a reload does not replay it.
- `UnreviewedCard`'s old `/course/<code>?writeReview=1` link fallback is
  **gone** — `unreviewed-card.tsx:41-45` records that there is deliberately no
  link fallback because the route it pointed at is retired.

**Confidence: high.**

### T-02 — the stored round is pruned rather than trusted — **satisfied**

Worth recording because it is the kind of correctness nobody would notice was
missing. `sessionStorage` says what this tab was doing, not what is still true —
the reader may have reviewed some of those courses in the workspace pane or in
another tab since. `taken-courses.tsx:269-300` keeps a course in a restored
round on exactly one of two grounds: it is still unreviewed, or *this round
saved it* (which is why it is no longer unreviewed, and is what the progress row
counts). A course this round **skipped** that has since been reviewed elsewhere
is dropped, so the done screen cannot report it as "still unreviewed" or deal it
again under "Go through the skipped ones". An interrupted round outranks the
deep link, because it holds answers that were typed and never saved.
**Confidence: high.**

### T-03 — the arrival effect reads `window.location` rather than `useSearchParams` — **intentional deviation, sound**

`app/(service)/taken/page.tsx` renders `<TakenCourses />` with **no `Suspense`
boundary**, which would normally be a prerendering hazard. It is not one here:
`taken-courses.tsx:232-236` deliberately reads `?review=1` off
`window.location.search` inside an effect precisely so the route stays
prerenderable without a boundary. It is a one-shot note from another page,
consumed on arrival and never rendered from, so an effect is the honest place
for it.

I checked this rather than assuming, because a `useSearchParams` here would be a
real build-time defect. It is correct as written. **Confidence: high.**

### T-04 — the transcript never touches persistent storage — **satisfied**

`transcript-drop-zone.tsx:28` records the rule and the code keeps it: the file
is handed to `uploadTranscript` and never kept — not in state, not in a query
cache, never in `localStorage`. Nothing is written until "Looks right", and
`planTranscriptImport` adds courses that are new and fills fields that are empty
but never overwrites a correction the reader made by hand. Course codes the
catalogue does not have come back as `unmatched` and are **named** rather than
invented, because `user_taken_courses.course_code` is a foreign key to
`courses.code`. **Confidence: high** (read off the client; the parser itself is
`server/**` and out of scope).

> **Superseded in part.** Opening `/taken` to signed-out visitors added one
> named exception to "never in `localStorage`":
> `features/taken/lib/guest-proposal.ts` holds a *parsed proposal* — never the
> file — for the length of one sign-in, with grades stripped unless the reader
> turned them on, and with a thirty-minute expiry. Everything else in T-04 still
> holds: the file is still never kept, and nothing is written until the reader
> confirms.
>
> Note also that this section cites `docs/design_ref_new/`, a path that no
> longer exists. The artboards are **revised** at each export, not merely moved,
> so the design claims above were made against a revision that may differ from
> `docs/design_ref/2026-09-06/`. The paths are left as written rather than
> rewritten, because rewriting them would make claims about an older revision
> read as current.

---

# Route 6 — My Page (`/profile`)

**Artboard:** `docs/design_ref_new/Course Community - My Page.dc.html` (877 lines).
**Files inspected:** `apps/web/app/(service)/profile/page.tsx`,
`features/my-page/components/my-page.tsx`, `identity.tsx`, `stat-card.tsx`,
`review-column.tsx`, `node-profile.tsx`, `account-settings.tsx`,
`delete-review-dialog.tsx`, `features/my-page/hooks/use-average-preference.ts`,
`features/my-page/lib/grade-average.ts`,
`features/my-page/lib/personalization-tiers.ts`.

## Control inventory

| Control | Behaviour | Verdict |
|---|---|---|
| Four tabs (Overview / Reviews / My dot / Settings) | `role="tablist"`, `aria-selected`, roving `tabIndex`, arrow-key movement | satisfied — a real tablist, not a nav of links |
| "Calculate my average" switch | `useAveragePreference`, per-account `localStorage` key | intentional deviation — M-03 |
| Unreviewed card button | `router.push("/taken?review=1")` | satisfied |
| Unreviewed card per-course row | `router.push("/taken?review=1")` | **defect — M-01** |
| Edit a review | `Review` dialog | satisfied |
| Delete a review | `DeleteReviewDialog` → `useRemoveReview` | satisfied — confirms before mutating |
| Node palette | read-only, no writer | intentional deviation — M-04 |
| Sign-in prompt when signed out | `/auth` link | satisfied |
| "Explore" empty-state link | `/search` | satisfied |

The tablist is worth calling out as satisfied: arrow-key movement with a roving
`tabIndex` is the half of the tab pattern most often left out, and it is here
(`my-page.tsx:219-224`, `onTabKeyDown`). The four sections have no URL of their
own, which is why a tablist rather than links is the right control.

## Findings

### M-01 — a per-course row on My Page discards the course it names — **defect**

**Severity: S2** — a control does something other than what it says.
**Confidence: high.**

`features/my-page/components/my-page.tsx:334-339`:

```tsx
<UnreviewedCard
  courses={unreviewed.courses.map((course) => ({ code: course.courseCode }))}
  onStart={() => router.push("/taken?review=1")}
  onSelect={() => router.push("/taken?review=1")}
/>
```

`UnreviewedCard`'s contract is `onSelect?: (courseCode: string) => void`,
documented at `unreviewed-card.tsx:36-38` as *"Opens the reviewer on **this one
course**."* My Page's handler takes no parameter and **throws the course away**.

The other host honours it. `taken-courses.tsx:660` passes
`onSelect={(courseCode) => openReviewer(courseCode)}`, and `openReviewer`
(`:335-345`) puts that code at the *front* of the queue with the rest dealt
behind it — the artboard's own behaviour.

So the same card, in two places, does two different things. On My Page every row
is indistinguishable from the button: a reader who clicks "DD2380" gets a round
that starts at whichever course happens to be first in `unreviewed`. Nothing
tells them their click was ignored.

**Root cause:** the route contract `/taken?review=1` carries no course, so My
Page has no way to express "start on this one" and silently degrades to "start
on all". `taken-courses.tsx` only ever tests `get("review") === "1"`.

**What the fix would be.** Two parts:

1. Widen the contract. Either `/taken?review=<CODE>` (with `1` keeping today's
   meaning of "no particular course"), or `/taken?review=1&start=<CODE>`. The
   first is tidier; the second is more obviously backward compatible. **This is
   a route-contract choice and I am escalating it** rather than picking one.
2. In `taken-courses.tsx`'s arrival effect, carry the code through `pendingOpen`
   to `openReviewer(code)`. The queue machinery already accepts a `startCode`,
   so nothing below the effect changes.

**Remaining risk if left:** low harm, high confusion. The reader still reaches a
reviewer that can review the course; it just is not the one they asked for, and
their skip/queue order is not what they expected.

### M-02 — My Page's unreviewed rows show the course code twice — **defect, S3**

**Confidence: high** on the rendering; **high** on the cause.

`UnreviewedCard`'s row renders `{course.code}` (`unreviewed-card.tsx:75`) then
`{course.name || course.code}` (`:78`), matching the artboard, whose row is
`{{ c.code }}` then `{{ c.name }}` with `name: c.name || c.code` as the fallback
(`Course Community - Unreviewed Card.dc.html:23-24`, `:50`).

My Page passes `{ code: course.courseCode }` and **no `name`**, so every row
falls back and reads `DD2380   DD2380`. Taken courses passes
`name: names.get(course.courseCode)` and renders properly.

**Root cause:** a genuine data gap, not just an oversight.
`user_taken_courses` stores only a course code; the title lives on `courses` and
is the screen's to look up. `taken-courses.tsx:160-166` does that lookup with
`useCourseSummaries(courseCodes, …)`. My Page's `useUnreviewedTakenCourses()`
returns `TakenCourse[]` and does no summary lookup, so My Page has no titles to
hand over.

**What the fix would be:** call `useCourseSummaries` on
`unreviewed.courses.map(c => c.courseCode)` in My Page and build the same
`names` map, exactly as Taken courses does — or, better, move the lookup into
`useUnreviewedTakenCourses` so both hosts get names for free and neither has to
remember. The second is the deeper fix and the one I would recommend, since the
current split is what let the two hosts diverge in the first place.

The artboard's fallback means this degrades to something readable rather than
broken, which is why it is S3 and not S2.

### M-03 — "Calculate my average" lives in `localStorage` — **intentional deviation, documented, product decision open**

**Confidence: high.**

`useAveragePreference` keys on `cc:myPage:showAverage:${userId}` — scoped to the
account, not the origin, so two people sharing a browser get their own answer.
The hook is careful in every way that matters: it starts at the default on both
server and first client render and settles in an effect (so hydration matches),
it resets to the default before reading (so signing in as somebody else does not
leave the previous account's answer on screen), and both reads and writes are
wrapped because storage throws outright in a private window.

The deviation is that **it does not sync across devices**, and #127's own "Not in
scope" section names *"the 'Calculate my average' preference wanting a `users`
column"* as schema-track work. The page says so out loud rather than implying
otherwise, which is the correct handling of a limitation.

Recorded as an intentional deviation with a **standing server dependency**, not
a defect. It is the one piece of state on the page with nowhere to live.

### M-04 — the personalization tiers are all locked, and the design contradicts itself — **product decision required**

**Severity: S3.** **Confidence: high.**

Two separate things here, and both are honest in the code:

**(a) Every account is at tier 0.** Nothing in `server/` writes
`users.personalization_tier_earned`, so all three appearance axes render as
locked and the `unlockHint` copy describes intended rules rather than a mechanism
that runs. `node-profile.tsx:33-47` says this plainly, and the revised
`cc-store.js` agrees from the other side: *"Tier 0 accounts keep the default
look; only personalized nodes carry a row."* Correct — nothing is invented.
Server work, out of scope, recorded.

**(b) The design disagrees with itself about which tier buys which axis, and the
revision did not settle it.** From `personalization-tiers.ts:33-42`:

- The My Page artboard's rendered list builds `mk(2, "Dot style", …, "style")`
  and `mk(3, "Signal on click", …, "signalStyle")`.
- `cc-store.js`'s `TIER_AXES` constant is `{ 1: "color", 2: "signalStyle",
  3: "style" }` — **the opposite pairing for 2 and 3**.

I confirmed both halves survive unchanged into the `docs/design_ref_new/` export,
so this is not stale: the revised design still contradicts itself. The code
follows the *rendered list*, on the grounds that it is what a reader of the
artboard sees, and the schema is silent —
`personalization_tier_earned` is one number and no column says which axis a tier
buys.

**Escalated to the product owner.** This cannot be resolved by matching the
artboard, because the artboard says both things. Whoever writes that column
settles it, and until then the choice made here should be recorded as
provisional rather than as design conformance.

### M-05 — "Dormant" collapses into "Locked" — **intentional deviation, documented**

The artboard has a third badge for a tier that was earned and has since decayed.
Telling dormant from locked needs the *earned* tier beside the *effective* one,
and `graph.effectiveTier` returns a single number. Rather than guess, the two
collapse into "Locked", and nothing anywhere is phrased as having lost a tier —
which is right, because `personalization_tier_earned` is never lowered, so a row
reading "you lost this" would assert something the database never records.
**Satisfied as a deviation.** **Confidence: high.**

### M-06 — the tab count pill is withheld while the list is unknown — **satisfied**

The Reviews tab's count is derived from `reviews.list`, and the code refuses to
render it on any terms the panel itself would not accept: an empty list is both
what the query holds in flight and what it may still hold from an earlier read
once it has failed, so a confident "0" beside "Your page did not load" would
state a total the page has just said it does not have. This is the same
"render only data the real contracts provide" discipline as E-01, applied to a
number rather than a pager. **Confidence: high.**

---

# Surface — course cards

**Artboard:** `docs/design_ref_new/Course Community - Course Card.dc.html` (290 lines).
**Files inspected:** `features/courses/components/course-card.tsx`,
`course-card-item.tsx`, `course-item-skeleton.tsx`,
`features/courses/hooks/use-course-card.ts`,
`features/courses/lib/course-card-model.ts`, `card-geometry.ts`,
`collection-order.ts`, `apps/web/types/course-card.ts`,
`apps/web/data/course-card-sample.ts`.

## Control inventory

| Control | Handler | Signed-out |
|---|---|---|
| Card body / title → open | `onOpen` → `workspace.open(code,"details")` | works (browsing is open) |
| "Write a review" | `c.onReview` | opens a review tab; auth is asked at publish |
| Save (split button, `action="save"`) | `c.onSave` | `onRequestAuth("save")` |
| Collection picker (▾ or standalone) | `c.onPicker` | picker shows a sign-in prompt |
| "New collection" inside picker | `c.onNewCollection` → inline draft field | signed-in only |
| Mark as taken | taken picker | `onRequestAuth` |
| Remove (Saved / Collections) | `onRemove`, named by `removeLabel` | n/a |

`geo.showLabel` plus a `@max-[440px]` container query drops every button label at
the narrow end, keeping the icon. The accessible name is the *same string* as the
visible label in each case — `course-card.tsx:399-405` carries the note that a
visible label the accessible name does not contain is unreachable by voice
control (WCAG 2.5.3), and that the label cannot be the only name because the
container query hides it. That is a genuinely well-handled responsive
accessibility case and I record it as satisfied.

## Findings

### CC-01 — `notCreating` is written and never read — **defect, S4; deferred item 7 confirmed**

**Confidence: high.**

`apps/web/types/course-card.ts:131` declares `notCreating: boolean`,
`features/courses/lib/course-card-model.ts:247` computes `notCreating: !creating`,
and `apps/web/data/course-card-sample.ts:116` sets `notCreating: true`. I grepped
the whole of `apps/web` — those three lines are the **only** occurrences. Nothing
reads it.

**Root cause:** it is the artboard's own field. The design's template engine has
no `else` branch, so it needs a negated boolean to draw the other half of a
conditional; JSX has a ternary and does not. The field came across in the
"extract verbatim" pass and never acquired a reader.

**What the fix would be:** delete all three lines. Typecheck-verifiable and
zero-risk — a required field with no readers cannot break a consumer. Note that
`card-geometry.spec.ts` and `course-card.spec.tsx` assert against `SAMPLE_*`
literals, so the fixture line goes with the type or the type stops matching.

### CC-02 — "Write a review" renders unconditionally while `onReview` is optional — **defect, S4; deferred item 7 confirmed**

**Confidence: high** on the code; **high** that no consumer trips it today.

`use-course-card.ts:34` declares `onReview?: () => void` and
`types/course-card.ts:145` carries it through as optional, but
`course-card.tsx:333-346` renders the button with no guard:

```tsx
<button type="button" onClick={c.onReview} title="Write a review" …>
```

A consumer that omits `onReview` gets a fully-styled, focusable button that does
nothing when clicked — the inert-control class #134 asks about.

**Why it does not bite today:** all four consumers pass one — `explore.tsx:200`,
`saved.tsx:309`, `collection-detail.tsx:240` and `collections.tsx:435`. So this
is a latent contract defect, not a live inert control, and I am not overstating
it.

**What the fix would be:** make the prop required, which is the honest reading —
every surface that shows a course card wants a review path, and there is now only
one place a review can be written from a card. Failing that, guard the render
(`{c.onReview ? <button …/> : null}`) so the optionality means something. The
first is better: an optional prop that every consumer supplies is a type that
lies. Contrast `onRemove`/`removeLabel`, which *are* conditional and *are*
guarded — so the pattern already exists in this file and this one control does
not follow it.

### CC-03 — the fixture is test-only, and its divergences are deliberate — **satisfied; "no production mock data" holds**

**Confidence: high.**

#134's acceptance criteria include *"no production mock data is restored"*. I
traced `apps/web/data/course-card-sample.ts`: its only importers are
`features/courses/components/course-card.spec.tsx` and
`features/courses/lib/card-geometry.spec.ts`. It is **never imported by a shipped
screen**, and the file says so.

Its header documents five known divergences from the schema as "do not fix them
here", each correct: the 1-5 scores predate the 1-10 decision and the *mapper*
converts; `keywords`/`summary` render empty for the reasons #97 settled;
`prereqCourses.inCatalog` is display-only; and the artboard's `comparisons`
family is renamed. One of those is worth pulling out:

`course-card-sample.ts:104` still carries the artboard's literal
`"1.2k students have taken this course · click to mark as taken"`. That is
**correct** — it is a verbatim extraction of the artboard's own string, and
`course-card-model.ts:161` is the shipped code, which says
`${formatCount(takenCount)} members have taken this course`. #97's correction 2
(members, never students — `user_taken_courses` counts app users, not KTH
enrolment) is implemented in the mapper and held by two tests
(`course-card-model.spec.ts:146`, `course-card.spec.tsx:305`). A reader never
sees "students".

I also confirmed the three mock routes #68 §5 ordered deleted are gone:
`app/(service)/reviews`, `app/editor-00` and `app/(public)/newsletter` (the four
hardcoded fake newsletter issues behind a no-op subscribe form) do not exist.
`page-title.spec.ts:42` asserts it.

---

# Surface — reviews

**Artboards:** `Course Community - Review Card.dc.html`,
`Course Community - Review Card Options.dc.html`,
`Course Community - Unreviewed Card.dc.html`,
`Course Community - Unreviewed Card Options.dc.html`.
**Files inspected:** `features/reviews/components/review.tsx`, `review-card.tsx`,
`review-list.tsx`, `reviewer.tsx`, `reviewer-card.tsx`, `unreviewed-card.tsx`,
`features/reviews/hooks/*`, `features/reviews/lib/*`,
`features/workspace/components/review-draft-panel.tsx`,
`features/workspace/components/course-details-panel.tsx`.

## Findings

### R-01 — one validator, one write path, three presentations — **satisfied**

`reviewFormSchema` runs in exactly one place, reached by `useAddReview` /
`useEditReview`. Three surfaces present a review draft — the workspace pane's
`ReviewDraftPanel`, the fast-track `Reviewer`, and the `Review` dialog — and all
three funnel through those hooks. The reviews barrel's own header states the
rule and refuses to export anything that would let a surface reach past them:
*"a surface reaching past them would be a review written without
`reviewFormSchema` having seen it, which is the one thing this feature exists to
prevent."* **Confidence: high.**

### R-02 — vote controls are absent rather than inert when signed out — **satisfied, with a consistency note**

`review-list.tsx:74-76` passes `onVote` only when `userId` is set, and
`review-card.tsx:183` renders the up/down buttons only when `onVote` is defined.
The score still shows. `useReviewVotes` additionally returns early on `!userId`,
so there are two independent guards over a `protectedProcedure`. No inert
control. **Confidence: high.**

**The consistency note, recorded not filed.** Everywhere else on a card a
signed-out action *prompts* — Save and Mark-as-taken call
`onRequestAuth(reason)` and open `AuthReasonDialog`. Voting instead vanishes, so
a visitor is never told that voting exists or that an account would unlock it.
`review-card.tsx:36-38` states this as deliberate — *"there is nothing to click
that cannot work"* — and that is a defensible principle; it is simply the
opposite principle from the one the course card applies two components away.
Not a defect, and I am not filing it; recorded because "is this control
consistent with its neighbours" is inside #134's scope and a reader would notice.

### R-03 — the reviews barrel still drags a CSS pipeline behind it — **defect, S4; deferred item 6 confirmed, partially mitigated**

**Confidence: high.**

The chain is real: `features/reviews/index.ts` exports `Review` →
`review.tsx:5` imports `RichTextEditor` from `@/components/RichEditor` → that
imports a Lexical theme and its stylesheet. Any module in the `logic` vitest
project (`environment: "node"`, no DOM, no CSS pipeline —
`vitest.config.ts:20-26`) that imports the barrel pulls all of it in.

**The mitigation that exists.** `features/workspace/lib/review-draft.ts:1-17` is
"the one place in this repo that reaches past a feature barrel", importing
`@/features/reviews/lib/review-draft` directly, with a comment giving exactly
this reason and noting that the *type* still comes through the barrel because
types are erased. I verified the seam holds: that is the **only** `features/*/lib/`
or `lib/` module importing `@/features/reviews`, and it imports only a type.

**Why it is still a finding.** The mitigation is a documented exception at one
call site, not a fix to the cause. The barrel still exports a component that
pulls a stylesheet, so the next pure module that needs `toReviewFormData` or
`ReviewDraft` will import the barrel — the obvious thing to do, and what the
repo's own conventions tell it to do — and only discover the problem when the
`logic` project fails to parse CSS.

**What the fix would be:** the deeper repair is to stop the barrel being the
only door. Either split a `features/reviews/model` entry point that exports the
pure lib surface with no component imports, or lift `review-draft.ts` and
`review-form-schema.ts` out from behind the component barrel. Both are
structural and belong in a fix pass, not here.

### R-04 — the `seminars` colour is chosen and justified — **satisfied**

#68 left the sixth examination colour to the implementing agent, with two
constraints. `features/reviews/lib/examination-palette.ts:23-52` picks
`seminars: "#4a7c2f"` — *"a deep moss green: green is the only region of the
wheel none of the other five occupy"* — with white ink, and records that white
reaches **4.98:1** on that fill. Blue, amber, teal, purple and slate are the
taken regions, and moss green is unambiguous against all five in a stacked bar.
Both constraints met, and the reasoning is written down where the next person
will find it. **Confidence: high** on the choice; I did not independently
recompute the contrast ratio.

### R-05 — six examination keys, not the design's five — **satisfied**

`cc-store.js` declares five `EXAMINATION_KEYS`; `apps/web/types/review.ts`
declares six, including `seminars`. #68 settled that the schema wins and
`seminars` stays. It is in the schema, the types, the review form and the
palette. The Swedish label `seminarier` is recorded for whoever adds an i18n
layer, and — correctly — **no i18n layer was built to satisfy it**.
**Confidence: high.**
---

# Cross-cutting — tokens, dead code, and things nobody assigned

## Findings

### X-01 — stale `docs/design/` and `docs/design_ref_old/` citations are gone — **satisfied; deferred item 4 is closed**

**Confidence: high.**

Deferred item 4 records stale `docs/design/` citations in `my-page/`, `reviews/`,
`saved/`, `search/` and `taken/`. I grepped the entire repository — every `.ts`,
`.tsx`, `.css` and `.md` file — for `docs/design/` and for `design_ref_old`.
**Zero hits.** Every surviving citation names `docs/design_ref_new/`.

The brief warned that the path was "the smaller half of the problem" and that a
comment citing the old folder might be wrong about the *design* rather than only
about the path. So I did not stop at the grep: I re-read the revised artboards
behind the claims most likely to have gone stale, and the results are recorded
under their own routes — C-02 (the compact chip, which the revision **fixed**,
closing a deferral that reads as open), L-01 (the landing copy, which the
revision did **not** change, so the deviation is still live and still correct),
and E-05 (the Mobile Preview's sheet stack, where the artboard says something
the code does not do).

The one residue of the old numbering I found is C-03, a line number that moved
inside a correctly-named file.

### X-02 — `color-mix` still derives two tints that have real tokens — **defect; a #127 §1 "Done when" line is not met**

**Severity: S3** in light theme, **S4** in dark. **Confidence: high.**

#127 §1's closing condition is *"No `color-mix` derivation remains where a real
tint token exists"*, and `globals.css:182-187` states the rule in the codebase's
own words:

> *"…none of them is derivable from `--cc-success` / `--cc-danger`: dark states
> them as alpha over the page, light as flat mixes that are not a percentage of
> anything. **Anything deriving one with `color-mix` is reading the palette from
> before these existed (#127 §1).**"*

Two live sites still do exactly that:

| File | Line | Derivation | Token that exists |
|---|---|---|---|
| `features/search/components/explore.tsx` | 330 | `color-mix(in srgb, var(--cc-danger) 12%, var(--cc-surface))` | `--cc-danger-tint` |
| `features/workspace/components/review-draft-panel.tsx` | 726 | `color-mix(in srgb, var(--cc-success) 12%, var(--cc-surface))` | `--cc-success-tint` |

I verified the tokens exist on both sides of the mirror: `globals.css:188-194`
(light) and `:345-348` (dark), and `docs/design_ref_new/cc-theme.css:44-52`
(light) and `:93-101` (dark) as `--successTint` / `--dangerTint`.

**How visible it is, stated honestly rather than inflated.** Computing the light
values: `color-mix(in srgb, #b3261e 12%, #ffffff)` ≈ `#f6e5e4`, a pink, against
`--cc-danger-tint` `#fdf3ef`, a warm peach — a visible hue difference on the
Explore error panel's circle. The success pair is much closer:
`color-mix(in srgb, #1c7a4a 12%, #ffffff)` ≈ `#e4efe9` against
`--cc-success-tint` `#e9f3ef`. In dark the alpha token composites over the same
surface the mix uses, so both are near-identical there. **So this is primarily a
palette-hygiene and drift-risk defect, and secondarily a small visible
divergence in the light theme.** I am not claiming it is glaring.

**The sharper half of the finding is that the justification is now false, and
the artboard says so in as many words.** `explore.tsx:321-325` reads:

> *"Its tinted circle has no token — `cc-theme.css` carries no error surface — so
> the fill is mixed from `--cc-danger` rather than pinned to the artboard's
> `#fbeceb`…"*

`cc-theme.css` **does** carry an error surface, and
`Course Community - Design System.dc.html` does not merely define the tokens —
it has a whole "Status banners" section that **names this exact combination**.
Its `BANNERS` constant (line 175-180) is:

```js
["--successTint", "var(--successTintBorder)", "var(--successInk)", "Upload success banner"],
["--dangerTint",  "var(--dangerTintBorder)",  "var(--dangerInk)",  "Error banner"],
```

So the design system artboard designates `--dangerTint` as *the* error banner
surface, and the one place in the app that draws an error banner derives its own
instead, under a comment asserting no such token exists. That is how a
derivation survives three reconciliation passes.

`feedback-form.tsx:112-114` already cites this same `BANNERS` table when it
migrated the success panel — so the evidence was found once, used for one of the
two families, and not carried across to the other.
`collection-chip.tsx:106-112` contains the argument in general form, written
while migrating the same derivation: *"The derivation was never the design's:
dark states the tint as alpha over the page, so no percentage of the solid
reaches it."*

**What the fix would be:** replace both with `bg-cc-danger-tint` /
`bg-cc-success-tint` (plus `--cc-success-ink` for the published banner's text,
which currently uses `var(--cc-success)` — the solid, not the ink), and delete
the two stale sentences. Two class changes and a comment. The #127 §1 sites that
were *named* — the feedback form's success and error panels, and the collection
chip and tile — are all correctly migrated already; these two were not on that
list, which is why they were missed.

### X-03 — the workspace pane's dragged width is not persisted — **defect, S4; deferred item 3 confirmed still open**

**Confidence: high.**

`features/workspace/components/workspace-pane-host.tsx:117` holds the width in
`useState(PANE_DEFAULT)`. `features/workspace/lib/workspace-storage.ts:29-32`
defines four `sessionStorage` keys — `cc.workspace.open`, `cc.workspace.drafts`,
`cc.workspace.published`, `cc.workspace.awaiting-sign-in` — and **none of them
is a width**. So the open tab list, the half-written drafts and the
already-published markers all survive an OAuth round trip, and the column size
the reader dragged does not: they come back from signing in to their courses at
the default 504px.

The drag itself is complete and well built — pointer drag, arrow-key nudge, a
double-click reset, a measured floor from `CARD_RAMP_FLOOR`, and a title
attribute naming all three. It is only the persistence that is missing.

**What the fix would be:** a fifth key, `cc.workspace.width`, written from
`resize()` and read in the same restore effect the open list uses, clamped
through the existing `clamp()` (which already guards an unmeasured row). The
restore must go through an effect rather than initial state, exactly as
`useWorkspacePane` does, or the server and first client render disagree.

**A judgement call worth recording:** `sessionStorage` is the right store here
only if the width is meant to be per-tab, like the open list. If it is meant to
be a preference, it belongs in `localStorage` and the choice differs from every
other key in that file. I lean per-tab for consistency, but flag it.

### X-04 — dead code — **defect, S4**

**Confidence: high** for each row; each was verified by grepping the whole of
`apps/web` for every import form.

| Path | Files | Importers | Note |
|---|---|---|---|
| `components/blocks/editor-00/` | 3 | **0** | deferred item 2, confirmed |
| `components/Textarea.tsx` | 1 | **0** | not previously recorded |
| `components/ui/**` unused primitives | 35 | 0 each | vendored library, see below |

**`components/blocks/editor-00/**` — deferred item 2 confirmed.** `editor.tsx`,
`nodes.ts` and `plugins.tsx`. Nothing imports them; the only mention of the
string `editor-00` anywhere in the repo is a comment in
`features/shell/lib/page-title.spec.ts:42` noting that the `/editor-00` *route*
is gone. `RichEditor` uses `components/editor/**` directly and does not go
through this block.

One thing to check before deleting, which is why I am recording it rather than
saying "just delete": `components/blocks/editor-00/editor.tsx:10` is the **only**
importer of `@/components/editor/themes/editor-theme`. Removing the block may
orphan that module too. `RichEditor.tsx` imports `ContentEditable` and the
format plugins from `components/editor/**` but not the theme, so a deletion pass
should re-run the orphan check afterwards rather than assuming a clean cut.

**`components/Textarea.tsx` — a new finding.** Zero importers. The three
`Textarea` hits elsewhere are `components/ui/input-group.tsx` referencing
`components/ui/textarea`, a different file. Safe to delete.

**The 35 unused `components/ui/**` primitives are *not* a defect and I am not
filing them.** shadcn primitives are a vendored library that is copied in whole
and drawn from as needed; an unused `calendar.tsx` is a component not yet
needed, not dead code someone forgot. I list them only so the ledger is honest
about what the sweep saw. They do carry one consequence worth knowing: several
use scroll utilities from a different vocabulary (`no-scrollbar`,
`scrollbar-thin`, `scrollbar-none`) than the `scrollbar-subtle` /
`scrollbar-hidden` convention in `globals.css`, which is a reason to leave them
out of scope for N-03 rather than to align them.

### X-05 — `/contact` is reachable, and the rail's single "About & contact" entry is correct — **satisfied**

Checked because an unreachable route is exactly the kind of thing nobody is
assigned. `/contact` renders `Contact` → `FeedbackForm`, and it is linked from
`features/my-page/components/account-settings.tsx:233`. The rail carries no
separate Contact entry, but that is right: the artboard is one page called
*"About & contact"* which imports the Contact Form artboard as a section, so
`about.tsx` renders the form inline and the rail's footer link is labelled
"About & contact" (`rail.tsx:204-216`). Both doors reach the form. The Landing
artboard's rail draws a separate "Contact" row (line 147); merging it into the
About entry follows the About artboard, which is the one that actually defines
the page. **Confidence: high.**

### X-06 — `pageTitleFor` deliberately omits the retired course route — **satisfied**

`features/shell/lib/page-title.ts:31-34` records that `/course` and
`/course/<code>` are absent on purpose: both are `redirect()` calls that throw
before anything renders, so *"a title for a route that never paints inside the
shell would be a claim this app no longer has a page to back."* `page-title.spec.ts`
holds the list and fails if a route is added without a title. This is the kind of
absence that reads as an oversight and is not one. **Confidence: high.**

---

# Requirements matrix

Every requirement #134 inherits from #127, plus #134's own acceptance criteria,
plus the eight deferred items the brief named. **Verified against the code as it
stands**, not against the state of any checkbox.

## #127 requirements, as #134 restates them

| # | Requirement | Status | Where |
|---|---|---|---|
| 1 | Adopt panel-tint and semantic tokens; remove `color-mix` where a token exists | **partly met** — named sites migrated, two unnamed sites remain | X-02 |
| 2 | Inspect feature code for stray hardcoded colours | **satisfied** | X-07 below |
| 3 | Verify the rail against the revised dark palette | **satisfied** | X-07 below |
| 4 | Re-diff every artboard against its implementation | **done**, 22 artboards | matrix below |
| 5 | `WorkspacePane` meaningfully mounted for Explore and Saved | **satisfied** | E-02 |
| 6 | Reconcile Saved organized / unorganized behaviour | **product decision required** | S-01 |
| 7 | Reconcile the landing → Explore transition | **satisfied** | L-02 |
| 8 | Reconcile the inaccurate side-by-side course copy | **satisfied** | L-01 |
| 9 | Reconcile compact Collection chip layout | **satisfied** — revision closed it | C-02 |
| 10 | Destructive Collection deletion confirms before mutation | **not met; conflicts with the artboard** | C-01 |
| 11 | Correct stale warning-token documentation | **satisfied** | X-07 below |
| 12 | Preserve Collection terminology; no "comparison" | **satisfied**, held by 5 guard tests | C-06 |
| 13 | Keep schema/server expansion out; render only real data | **satisfied** | E-01, M-04, M-06, CC-03 |

### X-07 — items 2, 3 and 11, grouped because each is a one-line answer

**Item 2 — stray hardcoded colours in `features/`.** I grepped every `.ts`/`.tsx`
under `features/`, `components/` and `app/` for `#rrggbb` literals. Every hit is
either **inside a comment** (quoting the artboard's hex while naming the token
that replaces it — `collection-chip.tsx`, `collection-tile.tsx`,
`course-card.tsx`, `feedback-form.tsx`, `rail.tsx`, `pane-parts.tsx`,
`neighbourhood-view.ts`, `explore.tsx`) or in
`features/reviews/lib/examination-palette.ts`, which is a **deliberate**
design-data constant — the artboard's own `EXAMINATION_COLORS` table plus the
sixth colour #68 authorised, and `course-card-sample.ts` sets the precedent for
holding design data as literals. The one hit in `components/ui/chart.tsx` is a
vendored shadcn recharts selector (`[stroke='#ccc']`), not a colour choice.
**No stray hardcoded colour in shipped feature styling. Satisfied.**

**Item 3 — the rail against the revised dark palette.** `rail.tsx:22-38` records
that `--cc-rail` changed meaning (its comment went from "brand blue in both
themes" to "darkens with the theme", and dark moved `#1751a6` → `#0d2e5e`), that
#85 was told the opposite, and that #127 §2 corrects it. It inherits the new
value from the token and the file states why the darker rail still reads
correctly against the revised `--cc-pg` `#071831`. **Satisfied**, and the
comment is accurate — I checked both values against `globals.css`.

**Item 11 — stale `--cc-warn-*` documentation.** #127 §4 says the comment calls
it *"the nudge to write a review"* while #88 showed the actual nudge uses
`--cc-btn` on `--cc-surface`. It has been corrected, and the correction
propagated: `feedback-form.tsx:214-218` records that the error line used to
borrow `--cc-warn-ink` and that *"`--cc-warn-*` turns out to mean the review
draft rather than anything that failed"*, and `workspace-pane.tsx:29-34` uses
`--cc-warn-ink` as the tab accent for a review being written — which is the
meaning the corrected comment asserts. **Satisfied.**

## #134's own acceptance criteria

| Criterion | Status | Where |
|---|---|---|
| Every applicable mobile action has the same meaningful outcome as desktop | **one gap** | E-05 |
| Explore mobile workspace uses the same API-backed panels and actions | **satisfied at the data layer**; tab switching is the exception | E-05 |
| Saved, Collections, Taken, My Page responsive controls verified not assumed | **done** — inventories per route | routes 3-6 |
| Every actionable #127 requirement closed or represented by a follow-up | **done** | this matrix + follow-ups |
| Drawer navigation and route titles accessible at supported breakpoints | **satisfied** | N-01 |
| No production mock data restored | **satisfied** | CC-03 |
| Quality, tests, typecheck, formatting pass | **satisfied** — unchanged from baseline | Gates |
| PR based on the latest confirmed `feat/frontend` | **satisfied** — `1e09ea5` | header |
| Greptile 5/5, zero unresolved threads | pending the loop | PR |

## The eight deferred items from waves 1 and 2

| # | Item | Verdict | Where |
|---|---|---|---|
| 1 | Hero canvas does not repaint on DPR change | **still open** | L-07 |
| 2 | `components/blocks/editor-00/**` orphaned | **still open**, confirmed by full-repo grep | X-04 |
| 3 | Pane's dragged width not persisted | **still open** | X-03 |
| 4 | Stale `docs/design/` citations | **closed** — zero hits; one line number moved | X-01, C-03 |
| 5 | `CollectionDetail` pins geometry while Saved ramps | **still open, and worse than recorded** | C-04, C-05 |
| 6 | Reviews barrel drags a CSS pipeline into the `logic` project | **still open, mitigated at one call site** | R-03 |
| 7 | `notCreating` unread; `onReview` optional but unconditional | **both still open** | CC-01, CC-02 |
| 8 | Suspense tripwire on the morph | **latent, not active** | L-08 |

## The three named bug patterns

| Pattern | Verdict |
|---|---|
| Unbounded render loops (`router` / `setParams` in deps) | **none found.** Four candidate effects, all guarded, all with comments naming the OOM crash — L-04 |
| Strict Mode double-mount over a ref-guarded destructive read | **none found.** The two such reads are both correct, for two different reasons — L-03 |
| Non-idempotent `openCourse` | **still present**, now S4 because every consumer guards its own call site — E-07 |

## Artboard coverage

All 22 files in `docs/design_ref_new/` were opened.

| Artboard | Implementation | Verdict |
|---|---|---|
| Landing | `features/landing/` | L-01 (authorised copy deviation), L-06 |
| Explore | `features/search/` | E-01, E-03 |
| Saved | `features/saved/` | S-01 |
| Saved copy | — | **an earlier variant, not a duplicate** — see X-08 |
| Collections | `features/collections/` | C-01, C-02, C-03 |
| Taken Courses | `features/taken/` + `Reviewer` | T-01 satisfied |
| My Page | `features/my-page/` | M-01, M-02, M-04 |
| Workspace Pane | `features/workspace/` | E-07; **the thinnest diff in this audit** |
| Course Card | `features/courses/` | CC-01, CC-02, CC-03 |
| Review Card | `features/reviews/review-card.tsx` | R-02 satisfied |
| Review Card Options | same | satisfied |
| Unreviewed Card | `unreviewed-card.tsx` | M-02 |
| Unreviewed Card Options | same | satisfied |
| Page Header | `features/shell/page-header.tsx` | N-01 satisfied — the whole artboard |
| Mobile Preview | shell drawer + sheet host | E-05, E-06, N-01 |
| About | `features/about/` | X-05 satisfied |
| Contact Form | `features/feedback/` | satisfied; adjacent to X-02 |
| Design System | tokens in `globals.css` | X-02, X-07 |
| Design System copy | — | **an earlier variant** — see X-08 |
| `cc-theme.css` | `app/globals.css` | tint families verified token-for-token for X-02; no value drift found |
| `cc-store.js` | — | reference data (`EXAMINATION_KEYS`, `TIER_AXES`) — R-05, M-04 |
| `support.js`, `ios-frame.jsx`, `assets/` | — | artboard scaffolding, nothing to implement |

### X-08 — the two "copy" artboards are earlier variants, not duplicates — **satisfied, and one of them is evidence**

**Confidence: high.** I nearly recorded both as duplicates on the strength of
their names and equal line counts. They are not; I diffed them.

**`Saved copy.dc.html` differs from `Saved.dc.html` in exactly one thing: the
scroll model.** Ten changed lines, all of it:

| | `Saved.dc.html` (primary) | `Saved copy.dc.html` |
|---|---|---|
| page column | `overflow:hidden` | `overflow-y:auto; overflow-x:hidden` |
| content wrapper | `flex:1; min-height:0` | no flex sizing |
| results column | `class="cc-pane-scroll"` + `overflow-y:auto` | `overflow-y:auto`, **no class** |
| helmet | defines `.cc-pane-scroll { scrollbar-width:none }` | rule absent |

So the copy is a variant in which **the page scrolls and the results column
keeps a default scrollbar**, and the primary is the one in which the page does
not scroll and the results column scrolls with its bar hidden.

**The implementation follows the primary, precisely.** `saved.tsx:229-236` is
`PageColumn className="h-full min-h-0 overflow-hidden"` with the results div
`scrollbar-hidden … overflow-y-auto`. `scrollbar-hidden` is this codebase's
`cc-pane-scroll`, and `globals.css` calls hiding the bar "the deliberate
exception, and the only one" for exactly the surfaces that carry their own
scroll affordance. **This is independent confirmation of N-02**: the hidden
scrollbar on Saved's and Explore's results columns is not a shortcut, it is the
artboard's own choice, and the rejected alternative is sitting in the folder
next to it.

**`Design System copy.dc.html` is the older of that pair** — 81 diff lines, and
the primary is strictly richer: it adds the whole **"Status tints"**, **"Status
banners"** and **"Checked state"** sections that the copy lacks, plus a
different wordmark treatment. Those added sections are the `TINTS`, `BANNERS`
and `--checkedTint` documentation, which is to say: *the sections that exist
precisely because the tint families were added in the revision*. That is the
evidence X-02 rests on, and it only exists in the primary.

**A note for whoever maintains the mirror:** neither "copy" is marked as
superseded, and both are plausible things for an agent to read first. Naming
them, or removing them, would prevent the mistake I nearly made. Recorded as an
observation, not filed — the folder is the product owner's mirror and outside
what I may change.

---

# Product decisions escalated

Five, in the order I would take them.

1. **C-01 — collection deletion is irreversible.** A #127 requirement says
   confirm before mutating; the artboard deletes on the click and the code
   matches the artboard. Recommend keeping the artboard's flow and adding
   **Undo** to the note that already appears, which is expressible in today's
   contracts. **This is the only S1 in the ledger.**
2. **S-01 — Saved's unorganized / all-organized split.** Unresolved since #127
   §4. Three shapes offered; the artboard now supplies the "Every saved course
   is in a collection" panel that #90's objection lacked.
3. **M-01 — `/taken?review=1` cannot name a course.** Needs a route-contract
   choice (`?review=<CODE>` versus `?review=1&start=<CODE>`) before the defect
   can be fixed.
4. **M-04 — tiers 2 and 3.** The revised design contradicts itself; the schema
   is silent. Cannot be resolved by matching the artboard.
5. **E-05 — one mobile sheet or a stack.** The artboard draws a stack; the code
   draws one sheet. The Mobile Preview artboard labels itself a draft concept,
   so its authority is weaker and the simplification may be intentional.

---

# Where this audit is thin

Stated plainly, because a ledger that does not say what it did not check cannot
be trusted about what it did.

- **Nothing was run in a browser.** Every responsive, visual and animation
  finding is read off class names, container queries and computed colour values,
  not observed. L-02's *feel*, E-05's stack, C-04's clipping and X-02's hue
  difference are all reasoned rather than seen. Confidence ratings reflect this.
- **No screen reader, and no real device.** The accessibility findings
  (`aria-live` mounting, the roving tablist, the WCAG 2.5.3 name/label match)
  are code-level reviews of the right patterns being present. Whether they
  *announce* correctly is unverified.
- **`server/**` was not audited**, per scope. So client/server contract
  mismatches would only surface where the client already documents them. I found
  none that the client had not already recorded — but I was not looking from the
  server side, and #134's own pre-audit comment about graph account placement
  (`joinCommunityGraphOnSignUp`, self-repair on first read) is a server-side
  claim I verified only the client half of.
- **The `logic`/`ui`/`server` vitest split was not stress-tested.** R-03 is a
  latent import-weight problem; I verified the seam holds today by grepping, not
  by adding a test that would fail if it broke.
- **Coverage is breadth-first by instruction.** Ten routes in one pass means
  each got roughly an hour. The workspace pane's `ReviewDraftPanel` (~750 lines)
  and `CourseDetailsPanel` (~400 lines) were read for wiring, states and the
  named bug patterns, but **not diffed property-by-property** against
  `Course Community - Workspace Pane.dc.html`, which is the largest artboard with
  the second-largest revision (62 changed lines, 34 involving tokens). If one
  place is hiding a divergence I did not find, it is there.
- **I did not recompute the `seminars` contrast ratio** (R-04); I recorded the
  4.98:1 the source claims.
- **Test quality was not audited.** 843 tests pass, and I did not ask whether
  they assert the right things. Several findings here (CC-01, CC-02, X-03) sit in
  code with tests around it, which means the tests are not asserting these
  properties.
---

# Follow-up issues filed

Nine. Each links back to its ledger reference. Nothing was fixed on this branch.

Every **actionable** finding is represented below. The findings deliberately
*not* filed are listed under "recorded but deliberately not filed" further down,
each with its reason — those are the ones I judged to be observations rather
than work. Read the two lists together; neither is complete on its own.

| Issue | Title | Ledger refs | Severity | Label |
|---|---|---|---|---|
| [#154](https://github.com/kthaisociety/KTH-Course-Community/issues/154) | `openCourse` is not idempotent by identity, which is the engine behind both OOM crashes | E-07 | S4 now, S1 historically | `bug`, `ready-for-agent` |
| [#155](https://github.com/kthaisociety/KTH-Course-Community/issues/155) | Collection deletion is irreversible: the artboard and #127's requirement disagree | C-01 | **S1** | `bug`, `ready-for-human` |
| [#156](https://github.com/kthaisociety/KTH-Course-Community/issues/156) | Saved's unorganized / all-organized split needs a product decision | S-01 | S3 | `enhancement`, `ready-for-human` |
| [#157](https://github.com/kthaisociety/KTH-Course-Community/issues/157) | My Page's unreviewed rows discard the course they name | M-01, M-02 | S2, S3 | `bug`, `ready-for-human` |
| [#158](https://github.com/kthaisociety/KTH-Course-Community/issues/158) | Two `color-mix` derivations remain where a tint token exists (#127 §1) | X-02 | S3 / S4 | `bug`, `ready-for-agent` |
| [#159](https://github.com/kthaisociety/KTH-Course-Community/issues/159) | `CollectionDetail` pins card geometry, wrong inside Saved's narrowed column | C-04, C-05 | S3 | `bug`, `ready-for-agent` |
| [#160](https://github.com/kthaisociety/KTH-Course-Community/issues/160) | Mobile workspace renders one sheet where the artboard stacks them | E-05, E-06 | S3, S4 | `enhancement`, `ready-for-human` |
| [#161](https://github.com/kthaisociety/KTH-Course-Community/issues/161) | The design contradicts itself about which tier buys which personalization axis | M-04 | S3 | `question`, `ready-for-human` |
| [#162](https://github.com/kthaisociety/KTH-Course-Community/issues/162) | Eight small findings: dead code, unread fields and latent risks | X-04, CC-01, CC-02, X-03, N-03, L-07, L-08, R-03 — **plus W-02 and C-03, added as comments** | S4 | `bug`, `ready-for-agent` |

**On #162's two added items.** W-02 (the review draft's absent "Save draft"
button) and C-03 (the stale artboard line number in `collection-chip.tsx`) were
both added to #162 **as comments rather than in its body**, because they were
found after it was filed. They are part of the issue and will be read with it,
but a check that reads only `gh issue view 162 --json body` will not see them —
which is exactly what happened during Greptile's review of this PR. Recorded
here so the next reader does not repeat that.

`ready-for-human` marks the four that carry a product decision an agent must not
make on its own. `ready-for-agent` marks the five that are fully specified.

The existing **#148** (Explore's pager) is confirmed still correct and still
correctly deferred — E-01. No new issue was opened for it and none should be.

## Findings recorded but deliberately not filed

Three, each with its reason:

- **L-09** — `useReducedMotion()` may return `null` on a first render, and
  `null` is falsy in the guard. I could not construct a real case, so it is a
  suspicion recorded at low confidence rather than a defect.
- **R-02's consistency note** — vote controls *vanish* when signed out, where
  Save and Mark-as-taken *prompt*. The card documents the choice and it is
  defensible; it is simply the opposite principle from the one applied two
  components away. Worth a reader's attention, not worth an issue.
- **X-08's note on the mirror** — `Saved copy.dc.html` and
  `Design System copy.dc.html` are earlier variants, not duplicates, and nothing
  marks them as superseded. I nearly misread them on the strength of their
  names. `docs/design_ref_new/` is the product owner's mirror and outside what
  an agent may change, so this is an observation for whoever maintains it.

## Regression journeys — specified, not added

#134 asks for cross-route regression journeys for the parity matrix. The brief
for this pass says explicitly **do not add them here**; specify them instead.
These are the seven that would have caught what this audit found, in the order I
would write them.

1. **Re-opening the active tab allocates nothing.** Call `openCourse` twice with
   the same `(code, kind)` when it is already active; assert the second call
   returns the **same object reference**. Catches E-07 / #154 directly, and is
   the one test that would have made both OOM crashes impossible.
2. **A per-course unreviewed row opens the reviewer on that course.** Render
   `UnreviewedCard` in both hosts, click the *second* row, assert the reviewer's
   first card is that course. Catches M-01 / #157, and would have caught the
   divergence between the two hosts at the moment it appeared.
3. **Deleting a collection is recoverable.** Whatever #155 decides, assert it:
   either a confirm appears before `collections.delete` is called, or the note
   offers an Undo that restores name, membership and order.
4. **A collection's cards ramp with the column on `/saved`.** Mount Saved with a
   workspace tab open and a collection detail open; assert the cards' `geo`
   matches the measured width rather than `EXPANDED_CARD_GEOMETRY`. Catches
   C-04 / #159.
5. **The rail is never transformed when Explore suspends.** Render Explore
   behind a boundary that suspends on first render, with a handoff in
   `sessionStorage`; assert the rail's inline transform is never set. Catches
   L-08 / #162 before it can ever happen.
6. **Every workspace control reachable on desktop is reachable on mobile.** A
   parity test that enumerates the controls `WorkspacePane` renders with and
   without `hideTabs` and asserts the difference is exactly the documented set.
   This is the general form of E-05 and would catch the next divergence rather
   than this one.
7. **Every scroll container carries a scrollbar utility.** A lint-shaped test
   over the source: any `overflow-auto` / `overflow-y-auto` / `overflow-x-auto`
   class list in `features/`, `app/` and `components/` must also carry
   `scrollbar-subtle` or `scrollbar-hidden`, with an explicit allowlist for
   `components/ui/**`. This is the only item on the list that turns a convention
   documented in a comment into something enforced, and it would have caught
   N-03 — the four containers the corrective pass missed.
---

# Addendum — Workspace Pane, the artboard I flagged as thinnest

Written after the rest of the ledger. "Where this audit is thin" named
`Course Community - Workspace Pane.dc.html` as the largest artboard with the
second-largest revision (62 changed lines, 34 involving tokens) and the one I
had read for wiring rather than diffed. Rather than leave that as a caveat, I
went back and diffed its reader-facing surface.

**Method:** extracted every reader-facing string from the artboard (47 of them)
and grepped `features/` for each. Forty-five are present. Two are not, and they
turn out to be different in kind.

## W-01 — "No open panes" is unreachable, and correctly so — **satisfied**

**Confidence: high.**

`Course Community - Workspace Pane.dc.html:54-56`:

```html
<sc-if value="{{ noTabs }}">
<div style="…">No open panes</div>
</sc-if>
```

I first read this as a missing empty state. It is not. Its position matters: it
sits **inside** the `overflowOpen` branch (line 45), which is the "All open
panes" dropdown — so it is the empty state of the *switcher list*, not of the
pane.

In the implementation that state cannot arise, by construction and at three
levels:

- `WorkspacePaneHost` returns `null` when `openCourses.length === 0`
  (`workspace-pane-host.tsx:73`).
- `WorkspacePane` returns `null` when there is no active entry
  (`workspace-pane.tsx:105`).
- The dropdown is inside `{!hideTabs && …}`, and its items map `openCourses`,
  which is therefore non-empty whenever the trigger exists.

So the switcher can never be open over an empty list. The artboard needs the
branch because its pane is a persistent column that renders whether or not
anything is open; this pane is mounted by its host only when there is something
to show. **Not a divergence — an artboard state with no counterpart, correctly
absent.** Recording it because "string missing from code" would have been the
wrong conclusion and I want the reasoning on the record.

## W-02 — the review draft's "Save draft" button is missing — **divergence, undocumented**

**Severity: S4.** **Confidence: high.**

This one is real. `Course Community - Workspace Pane.dc.html:301-303` gives the
review-draft footer **two** controls:

```html
<div style="display:flex;justify-content:flex-end;gap:9px;padding:12px 20px">
<div style="…border:1px solid var(--rule3);…">Save draft</div>
<div onClick="{{ onPostReview }}" …>{{ postLabel }}</div>
</div>
```

`features/workspace/components/review-draft-panel.tsx` renders only the post
button (`:740-770`). The secondary "Save draft" is absent.

**And the artboard has both halves, not one or the other.** Line 170 is
`{{ savedLabel }}` in the draft header, defined at line 645 as
`untouched ? "Not saved yet" : "Saved just now"`. The implementation reproduces
that header line **exactly** — same two strings, same `11.5px`, same `--cc-dim`
(`review-draft-panel.tsx:381-383`). So it kept the artboard's status indicator
and dropped the artboard's button.

**Why dropping it is defensible.** The draft is persisted on every change:
`onDraftChange` → `patchDraft` → the `writeDrafts(drafts)` effect in
`workspace-pane.tsx:97-99`. There is no unsaved state for a button to resolve.
A "Save draft" control would either be a no-op, or would imply the draft had
been at risk — which is precisely what the header line already says it is not.

**Why it is still a finding.** Every other deviation in this codebase carries a
comment saying what was dropped and why — `FindYourDot`'s private link,
Explore's pager, `CollectionDetail`'s one-line rows, the landing's copy fix.
This one does not. A reader diffing the footer against the artboard finds a
missing button and no explanation, which is how a deliberate choice gets
"restored" by the next pass.

**What the fix would be:** a comment on the footer recording that the artboard's
"Save draft" is deliberately absent because the draft autosaves, and that the
header's `savedLabel` is what carries the reassurance. Documentation only — I am
**not** proposing the button be added. Added to #162.

## W-03 — the examination bar and approach slider arithmetic matches the artboard exactly — **satisfied**

**Confidence: high.** This was the specific thing the previous section said was
still uncompared, so I compared it.

`Course Community - Workspace Pane.dc.html` versus
`apps/web/features/reviews/lib/review-draft.ts`:

| What | Artboard | Code | Match |
|---|---|---|---|
| Even split base | `:324` `Math.max(5, Math.round(100 / n / 5) * 5)` | `evenShares`, `Math.max(MIN_SHARE, Math.round(100 / count / SHARE_STEP) * SHARE_STEP)` with both constants `5` | exact |
| Remainder | on the last segment (`evenSplit`) | `shares[count - 1] = 100 - base * (count - 1)` | exact |
| Divider clamp | `:435` `x = Math.max(5, Math.min(pair - 5, x))` | `moveDivider`, `Math.max(MIN_SHARE, Math.min(pair - MIN_SHARE, stepped))` | exact |
| Approach clamp | `:465` `Math.round(Math.max(5, Math.min(95, raw)))` | `Math.max(APPROACH_MIN, Math.min(APPROACH_MAX, Math.round(value)))`, `APPROACH_MIN = 5`, `APPROACH_MAX = 100 - 5` | exact |
| Score scale | `:466` `Math.max(1, Math.min(10, raw / 10))` | 1-10 displayed raw, per #68 | consistent |

The reasoning is carried across as well as the numbers: the code's comment on
`evenShares` explains that six methods do not divide 100 evenly and that the
remainder goes on the last segment *because* the alternative is a distribution
`examinationDistributionSchema` would refuse — which is the schema-side reason
the artboard's own choice happens to be the only workable one.

`moveDivider`'s comment states the invariant the clamp exists for: only the
dragged pair moves, so dragging one boundary never silently reflows the rest,
and neither side can reach zero because "a 0% segment would be a method the
reviewer picked and then said nothing about."

## What is now left uncompared on this artboard

Narrowing the earlier claim, since two of its three parts are now closed:

- **Copy and controls** — closed by W-01/W-02. 47 strings, 45 present, 2
  explained.
- **Drag arithmetic** — closed by W-03. Five constants and clamps, all exact.
- **Static spacing and token application** — *still uncompared.* The artboard's
  `margin-top:7px` (×6), `margin-top:11px` (×3), `height:6px` (×4),
  `height:8px` (×3), `height:38px` (×2) and the radii on the score and
  examination bars were not checked value-by-value against the JSX, and neither
  were the 34 token-touching lines of that artboard's revision.

That last item is the honest remainder of this audit's thinnest area. It is
static presentation on one surface, with no behavioural consequence — which is
why I stopped there rather than continuing past the point of diminishing
returns, and why I am naming exactly what was not done rather than implying the
diff is complete.

