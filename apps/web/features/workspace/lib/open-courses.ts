/**
 * The workspace pane's open list: which courses a user has open, in which
 * mode, and which one is in front.
 *
 * The pane is a tab strip over one body, so this is a small, pure state
 * machine and it lives here rather than inside the component — the tab sizing
 * tiers and the "what becomes active when you close the active tab" rule are
 * both easy to get subtly wrong and cheap to test in isolation.
 *
 * Nothing here decides persistence: these are pure transitions over a value.
 * `use-workspace-pane.ts` is what keeps that value in `sessionStorage` — under
 * the {@link WorkspaceScope} of the page that owns it — so that signing in, an
 * OAuth redirect away and back to the same route, returns to the courses that
 * were open there.
 */

/**
 * What an open course shows. `details` is the catalogue entry and what
 * reviewers said about it; `review` is an unpublished **review draft** for the
 * same course. A course can be open in both at once — that is two tabs.
 */
export type OpenCourseKind = "details" | "review";

/** One course open in the workspace pane. */
export interface OpenCourse {
  /** Stable across re-orders, so React keys and the active pointer survive. */
  id: string;
  courseCode: string;
  kind: OpenCourseKind;
}

/**
 * Which page's open list this is.
 *
 * A tab belongs to the page it was opened on: Explore's tabs live in Explore,
 * Saved's live in Saved, and neither page shows the other's. The artboards say
 * the same thing by construction — `Course Community - Explore.dc.html` and
 * `Course Community - Saved.dc.html` each declare their own `tabs: []` in local
 * state, and `cc-store.js`, the store they genuinely share, carries no tab
 * state at all.
 *
 * It is a domain word rather than a route string on purpose. The two hosts pass
 * it as a literal, so nothing here reads `usePathname()` and the open list stays
 * a value a test can hand around. See ADR 0007.
 */
export type WorkspaceScope = "explore" | "saved";

/** Every course open in the pane, in tab order, and which one is in front. */
export interface Workspace {
  open: OpenCourse[];
  /** `null` only when nothing is open. */
  activeId: string | null;
}

export const EMPTY_WORKSPACE: Workspace = { open: [], activeId: null };

/** A course a host has been asked to open by its own route. */
export interface OpenCourseRequest {
  courseCode: string;
  kind: OpenCourseKind;
}

/**
 * `?open=<code>&kind=details|review`, as a host reads it off its route.
 *
 * This pair is the only way in from outside the page. `/course/<code>` is a
 * redirect onto it — #68 §5 retired the course page, so a link anyone has
 * bookmarked or pasted has to land on the course as a tab — and Collections
 * navigates to Saved with it for the same reason.
 *
 * Both parts are forgiving on purpose, because the pair is typed by hand as
 * often as it is followed. A code is upper-cased, since that is how the
 * catalogue keys courses and `/course/dd2380` was a working URL. A `kind` that
 * is not `review` is `details`: opening the course is the safe reading of a
 * parameter nobody can see, and refusing the whole link over it would strand a
 * reader on an empty page.
 */
export function openCourseRequest(
  open: string | null | undefined,
  kind: string | null | undefined,
): OpenCourseRequest | null {
  const courseCode = open?.trim().toUpperCase() ?? "";
  if (!courseCode) return null;
  return { courseCode, kind: kind === "review" ? "review" : "details" };
}

/**
 * A location with `?open=` set to this course, so arriving there opens the tab.
 *
 * The inverse of `openCourseRequest`, and it exists for one caller: the sign-in
 * a guest is sent through from a half-written review. `?open=` is an
 * instruction, spent and removed the moment a host obeys it, so the URL a
 * reviewer is looking at while they write has stopped naming the tab they are
 * writing in. A sign-in that returns to that URL returns to the page without
 * the tab.
 *
 * That is survivable when the sign-in comes back to the same tab, where the
 * open list is still in `sessionStorage`. It is the whole game when it does
 * not: the magic link opens a **new** tab, and the URL the mail carries is the
 * only thing that reaches it. Putting the instruction back is what makes the
 * draft — which now waits in `localStorage` — have a tab to appear in.
 *
 * Takes and returns a path with its query, never an absolute URL, because that
 * is what a `callbackURL` is allowed to be. See `features/auth/lib/return-to`.
 */
export function withOpenCourse(
  location: string,
  courseCode: string,
  kind: OpenCourseKind,
): string {
  const [path, query = ""] = location.split("?");
  const params = new URLSearchParams(query);
  params.set("open", courseCode);
  params.set("kind", kind);
  return `${path}?${params.toString()}`;
}

/** The id a `(courseCode, kind)` pair always gets, so opening twice is idempotent. */
function openCourseId(courseCode: string, kind: OpenCourseKind): string {
  return `${kind}:${courseCode}`;
}

/**
 * Open a course, or bring it forward if it is already open.
 *
 * Re-opening never duplicates a tab and never resets what is in it: a review
 * draft the user has half-written survives a second click on "Write a review".
 *
 * ## Opening an already-front tab returns the *same object*
 *
 * Not merely an equal one, and this is load-bearing. Every unbounded render
 * loop this workspace has produced was an effect that called in here and then
 * re-ran because something it depended on had been rebuilt. A transition that
 * hands back a fresh `Workspace` for a no-op is the fuel: `useState` bails out
 * of a re-render only when the next state is `Object.is`-equal to the current
 * one, and a spread never is — so "open the course that is already open and
 * already in front" would re-render every host of this state, which rebuilds
 * `setParams`, which re-runs the effect, which opens the course again. The
 * guards in `use-explore.ts` and `saved.tsx` each stop that loop one caller at
 * a time; this stops it at the value.
 *
 * The bail-out is deliberately narrow. Bringing a *background* tab forward is a
 * real change and still allocates, because `activeId` genuinely differs.
 */
export function openCourse(
  workspace: Workspace,
  courseCode: string,
  kind: OpenCourseKind,
): Workspace {
  const id = openCourseId(courseCode, kind);
  if (workspace.open.some((entry) => entry.id === id)) {
    return workspace.activeId === id
      ? workspace
      : { ...workspace, activeId: id };
  }
  return {
    open: [...workspace.open, { id, courseCode, kind }],
    activeId: id,
  };
}

/**
 * Close one tab.
 *
 * Closing a tab that is not in front leaves the front one alone. Closing the
 * one in front hands the front to whatever slid into its place, or to the new
 * last tab when it was the rightmost.
 */
export function closeCourse(workspace: Workspace, id: string): Workspace {
  const index = workspace.open.findIndex((entry) => entry.id === id);
  if (index < 0) return workspace;

  const open = workspace.open.toSpliced(index, 1);
  if (open.length === 0) return EMPTY_WORKSPACE;
  if (workspace.activeId !== id) return { ...workspace, open };

  const next = open[Math.min(index, open.length - 1)];
  return { open, activeId: next.id };
}

/**
 * Bring an already-open tab forward. Unknown ids are ignored.
 *
 * Activating the tab that is already in front returns the same object, for the
 * reason spelled out on {@link openCourse}: a no-op that allocates is a
 * re-render nothing asked for, and this state has three hosts that size their
 * own layout against it.
 */
export function activateCourse(workspace: Workspace, id: string): Workspace {
  if (!workspace.open.some((entry) => entry.id === id)) return workspace;
  if (workspace.activeId === id) return workspace;
  return { ...workspace, activeId: id };
}

/**
 * How wide the tabs are drawn, which the design ties to how many are open.
 *
 * Three tiers, straight from the artboard: up to four tabs carry the whole
 * course code, five to eight drop the two-letter school prefix, and past eight
 * the tabs shrink to their colour dot alone. The full label is always on the
 * tab's `title`, so nothing the tier hides becomes unreachable.
 */
export type TabTier = "wide" | "medium" | "tight";

export interface TabLayout {
  tier: TabTier;
  /** Tailwind gap between tabs, in pixels. */
  gap: number;
  activeWidth: number;
  inactiveWidth: number;
  dotSize: number;
}

const TAB_LAYOUTS: Record<TabTier, TabLayout> = {
  wide: {
    tier: "wide",
    gap: 4,
    activeWidth: 104,
    inactiveWidth: 88,
    dotSize: 7,
  },
  medium: {
    tier: "medium",
    gap: 4,
    activeWidth: 90,
    inactiveWidth: 68,
    dotSize: 7,
  },
  tight: {
    tier: "tight",
    gap: 2,
    activeWidth: 44,
    inactiveWidth: 30,
    dotSize: 8,
  },
};

export function tabLayout(openCount: number): TabLayout {
  if (openCount > 8) return TAB_LAYOUTS.tight;
  if (openCount > 4) return TAB_LAYOUTS.medium;
  return TAB_LAYOUTS.wide;
}

/** The visible tab label for a tier. Tight tabs show no text at all. */
export function tabLabel(courseCode: string, tier: TabTier): string {
  if (tier === "tight") return "";
  if (tier === "medium") return courseCode.slice(2);
  return courseCode;
}

/**
 * The tab's own title, and what the overflow switcher lists.
 *
 * The design writes it as `"DD2380 · Details"`; both halves are reader-facing
 * copy, so the kind reads as "Review draft" even though the identifier is
 * `review`.
 */
export function openCourseLabel(entry: OpenCourse): string {
  return `${entry.courseCode} · ${entry.kind === "review" ? "Review draft" : "Details"}`;
}
