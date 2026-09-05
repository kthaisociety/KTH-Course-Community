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

`features/workspace/components/mobile-workspace-sheet-host.tsx:105-113` passes:

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
   at the right moment. `collections.create` plus `collections.reorder` can
   restore name, membership and order, so an undo is expressible in the
   contracts that exist today — no schema work. This satisfies "no irreversible
   destruction" *and* keeps the artboard's one-click delete.

**Escalated to the product owner.** Recommending option 2.

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
