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
