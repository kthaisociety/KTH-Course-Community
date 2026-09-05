"use client";

import { RotateCcw, Search as SearchIcon, TriangleAlert } from "lucide-react";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AuthReasonDialog } from "@/features/auth";
import { CourseCardItem, courseCardGeometry } from "@/features/courses";
import { PageColumn, PageHeader } from "@/features/shell";
import {
  MobileWorkspaceSheetHost,
  useWorkspacePane,
} from "@/features/workspace";
import {
  MAX_RATING_STARS,
  RATING_STAR_OPTIONS,
  useExplore,
} from "../hooks/use-explore";
import { useResultsWidth } from "../hooks/use-results-width";

type CourseOpen = { courseCode: string; kind: "details" | "review" };

// The pane is inactive for ordinary browsing and has its own data-heavy
// details/review views. Load it only once a desktop reader opens a course.
const WorkspacePane = dynamic(
  () => import("@/features/workspace").then((module) => module.WorkspacePane),
  { ssr: false },
);

/**
 * Explore: the search-and-browse workspace, and the app's front door to the
 * catalogue.
 *
 * From `docs/design/Course Community - Explore.dc.html`. Two things about it are
 * this page's alone:
 *
 * - **It owns the course card's collapse ramp.** `courseCardGeometry` turns the
 *   measured results-column width into the card's `geo`; Saved and Collections
 *   pin an end of that ramp and Explore is the page that actually travels it.
 *   The card measures nothing, which is why the geometry is a prop.
 * - **It is fully open to visitors.** Searching, browsing and reading reviews
 *   never need an account. Only saving and taking do, and those prompts live on
 *   the card — so nothing here gates the page, and the one `AuthReasonDialog`
 *   the whole list hands off to is rendered at the bottom of this component.
 *
 * ## Where it departs from the artboard, and why
 *
 * - The artboard's **workspace pane** — the resizable column that holds open
 *   course-details and review-draft tabs — is #94's. Until it lands, opening a
 *   card goes to the course's own page. Nothing here has to change when the pane
 *   arrives: the ramp reads the column's rendered width, so a pane opening beside
 *   it collapses the cards without Explore knowing the pane exists.
 * - The artboard's **pager** is not built. `search.courses` accepts a `page`
 *   input and ignores it, and returns `total: results.length` — the count of what
 *   it just returned. A pager over that would invent pages that do not exist.
 * - The artboard's **filter row does not exist** at all; #89 requires one. It is
 *   built here in the artboard's own control vocabulary.
 * - The artboard's **shared-element handoff from the landing hero** is not
 *   built, deliberately. It works by the landing page stashing its search bar's
 *   rect in `sessionStorage` and Explore translating its own bar out of it,
 *   fading the surroundings in behind and sliding the rail in on the same curve
 *   so the two read as one gesture. Both halves would have to be written:
 *   `features/landing/` stores nothing today, and the rail and topbar belong to
 *   `AppShell`, so Explore would be animating chrome it does not own. That is a
 *   lot of coupling across three merged features for 280ms that the artboard
 *   itself already drops under `prefers-reduced-motion` — and the receiving bar
 *   is the same element either way, so it can be added later without reshaping
 *   anything here.
 */
export function Explore() {
  const explore = useExplore();
  const workspace = useWorkspacePane();
  const containerRef = useRef<HTMLDivElement>(null);
  const desktopWorkspace = useContainerBreakpoint(containerRef, 768);
  const compactWorkspace = useContainerBreakpoint(containerRef, 640);
  // A restored workspace may exist before ResizeObserver reports this
  // container's size. Do not guess a presentation during that window: mounting
  // a Sheet would briefly lock the desktop page's body before the pane wins.
  const mobileWorkspace = compactWorkspace === null ? false : !compactWorkspace;
  const [pendingCourseOpen, setPendingCourseOpen] = useState<CourseOpen | null>(
    null,
  );
  const rowRef = useRef<HTMLDivElement>(null);
  const pane = useWorkspaceWidth(rowRef, workspace.hasOpenCourses);
  const [resultsRef, resultsWidth] = useResultsWidth();
  const geo = courseCardGeometry(resultsWidth);

  const { results, hasQuery, isLoading, isError } = explore;
  const showEmpty = hasQuery && !isLoading && !isError && results.length === 0;

  const layoutMeasured = desktopWorkspace !== null && compactWorkspace !== null;

  // The desktop column and phone sheet share the same state machine. The
  // in-between layout remains a route: it has neither enough width for the
  // column nor the narrow mobile chrome the sheet was designed for.
  const openMeasuredCourse = useCallback(
    (courseCode: string, kind: CourseOpen["kind"]) => {
      if (desktopWorkspace) {
        workspace.open(courseCode, kind);
        return;
      }
      if (mobileWorkspace) {
        workspace.open(courseCode, kind);
        return;
      }
      if (kind === "details") explore.onOpenCourse(courseCode);
      else explore.onReviewCourse(courseCode);
    },
    [desktopWorkspace, mobileWorkspace, workspace, explore],
  );

  const openCourse = useCallback(
    (courseCode: string, kind: CourseOpen["kind"]) => {
      if (!layoutMeasured) {
        setPendingCourseOpen({ courseCode, kind });
        return;
      }
      openMeasuredCourse(courseCode, kind);
    },
    [layoutMeasured, openMeasuredCourse],
  );

  useEffect(() => {
    if (!pendingCourseOpen || !layoutMeasured) return;
    openMeasuredCourse(pendingCourseOpen.courseCode, pendingCourseOpen.kind);
    setPendingCourseOpen(null);
  }, [layoutMeasured, openMeasuredCourse, pendingCourseOpen]);

  return (
    <PageColumn
      className="h-full min-h-0 overflow-hidden"
      contentClassName="h-full min-h-0 pb-0"
      containerRef={containerRef}
    >
      <PageHeader
        title="Explore courses"
        subtitle="Search the KTH catalogue and see what students said about a course before you pick it."
      />

      <search className="flex shrink-0 flex-col items-center gap-2.5 px-6 pt-[18px] pb-3.5">
        <form onSubmit={explore.onSubmit} className="w-full max-w-[560px]">
          <div className="flex h-[42px] items-center gap-2.5 rounded-[10px] border border-cc-rule3 bg-cc-surface px-3.5">
            <SearchIcon
              size={16}
              strokeWidth={2}
              className="shrink-0 text-cc-muted"
              aria-hidden
            />
            <input
              type="search"
              value={explore.field}
              onChange={(event) => explore.onQueryChange(event.target.value)}
              placeholder="Search a course, code or subject"
              aria-label="Search courses"
              className="min-w-0 flex-1 border-none bg-transparent text-[14px] text-cc-ink outline-none placeholder:text-cc-dim2 [&::-webkit-search-cancel-button]:hidden"
            />
          </div>
        </form>

        {/* Outside the form: each filter is its own committed choice, so there
            is nothing here for a submit to gather. */}
        <Filters explore={explore} />
      </search>

      <div ref={rowRef} className="flex min-h-0 flex-1 gap-[18px] px-5 pb-5">
        <div
          ref={resultsRef}
          data-testid="explore-results"
          className={`scrollbar-hidden min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto ${
            workspace.hasOpenCourses ? "max-w-none" : "mx-auto max-w-[1136px]"
          }`}
        >
          <div className="flex min-w-0 flex-col gap-3.5">
            {/* The live region stays mounted whatever the column is showing: one
            that appears together with its first message is announced
            unreliably. Before anything is searched it has nothing to say — the
            panel below carries that — so it says nothing. */}
            <div className="flex items-baseline gap-2 pl-0.5 text-[12px] text-cc-muted">
              <span aria-live="polite">{resultsLabel(explore)}</span>
              {hasQuery ? (
                <button
                  type="button"
                  onClick={explore.onClearQuery}
                  className="cursor-pointer font-medium text-cc-brand hover:underline"
                >
                  Clear search
                </button>
              ) : null}
            </div>

            {isLoading && results.length === 0 ? <ResultsSkeleton /> : null}

            {isError ? <ResultsError onRetry={explore.onRetry} /> : null}

            {showEmpty ? (
              <Panel dashed>
                <div className="font-semibold text-[14.5px]">
                  No courses match “{explore.query}”
                </div>
                <div className="mt-[5px] text-[13px] text-cc-muted">
                  Try a course code, a subject, or{" "}
                  <button
                    type="button"
                    onClick={explore.onClearQuery}
                    className="cursor-pointer font-medium text-cc-brand hover:underline"
                  >
                    clear the search
                  </button>
                  .
                </div>
              </Panel>
            ) : null}

            {!hasQuery && !isError ? (
              <StartHere onSuggest={explore.onSuggestQuery} />
            ) : null}

            {results.map((course, index) => (
              <CourseCardItem
                key={course.courseCode}
                course={course}
                stats={explore.statsFor(course.courseCode)}
                action="save"
                geo={geo}
                // The last card's picker would open past the foot of the column.
                pickerAbove={results.length > 1 && index === results.length - 1}
                onOpen={() => openCourse(course.courseCode, "details")}
                onReview={() => openCourse(course.courseCode, "review")}
                onRequestAuth={explore.setAuthReason}
              />
            ))}
          </div>
        </div>

        {workspace.hasOpenCourses ? (
          <div
            data-testid="workspace-pane-host"
            className="relative hidden min-h-0 min-w-[356px] @3xl:flex"
            style={{ width: pane.width }}
          >
            <WorkspaceResizeHandle pane={pane} />
            <WorkspacePane
              className="min-w-0 flex-1"
              openCourses={workspace.openCourses}
              activeId={workspace.activeId}
              onActivate={workspace.activate}
              onClose={workspace.close}
              onOpen={workspace.open}
            />
          </div>
        ) : null}
      </div>

      {mobileWorkspace ? (
        <MobileWorkspaceSheetHost
          openCourses={workspace.openCourses}
          activeId={workspace.activeId}
          onClose={workspace.close}
          onOpen={workspace.open}
        />
      ) : null}

      <AuthReasonDialog
        reason={explore.authReason}
        onReasonChange={explore.setAuthReason}
        onClose={() => explore.setAuthReason(null)}
      />
    </PageColumn>
  );
}

/** Matches Explore's `@3xl` layout transition against the actual container,
 * not the wider browser viewport. */
function useContainerBreakpoint(
  containerRef: React.RefObject<HTMLDivElement | null>,
  minimumWidth: number,
) {
  const [matches, setMatches] = useState<boolean | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? container.clientWidth;
      setMatches(width >= minimumWidth);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef, minimumWidth]);

  return matches;
}

const RESULTS_FLOOR = 470;
const PANE_MIN = 356;
const PANE_DEFAULT = 504;
const WORKSPACE_GAP = 18;

function useWorkspaceWidth(
  rowRef: React.RefObject<HTMLDivElement | null>,
  active: boolean,
) {
  const [width, setWidth] = useState(PANE_DEFAULT);
  const [rowWidth, setRowWidth] = useState(0);

  useEffect(() => {
    const row = rowRef.current;
    if (!row || typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(([entry]) => {
      setRowWidth(entry?.contentRect.width ?? row.clientWidth);
    });
    observer.observe(row);
    return () => observer.disconnect();
  }, [rowRef]);

  const max = Math.max(PANE_MIN, rowWidth - RESULTS_FLOOR - WORKSPACE_GAP);
  const clamp = useCallback(
    (next: number) => Math.max(PANE_MIN, Math.min(next, max)),
    [max],
  );

  useEffect(() => {
    if (active) setWidth((current) => clamp(current));
  }, [active, clamp]);

  return {
    width: clamp(width),
    resize: (next: number) => setWidth(clamp(next)),
    reset: () => setWidth(clamp(PANE_DEFAULT)),
  };
}

function WorkspaceResizeHandle({
  pane,
}: {
  pane: ReturnType<typeof useWorkspaceWidth>;
}) {
  const drag = useRef<{
    onMove: (event: PointerEvent) => void;
  } | null>(null);

  const finish = useCallback(() => {
    const activeDrag = drag.current;
    if (!activeDrag) return;
    window.removeEventListener("pointermove", activeDrag.onMove);
    window.removeEventListener("pointerup", finish);
    window.removeEventListener("pointercancel", finish);
    drag.current = null;
  }, []);

  useEffect(() => finish, [finish]);

  return (
    <button
      type="button"
      aria-label="Resize workspace"
      title="Drag to resize · double-click to reset"
      onDoubleClick={pane.reset}
      onPointerDown={(event) => {
        event.preventDefault();
        finish();
        const startX = event.clientX;
        const startWidth = pane.width;
        const onMove = (moveEvent: PointerEvent) => {
          pane.resize(startWidth - (moveEvent.clientX - startX));
        };
        drag.current = { onMove };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", finish, { once: true });
        window.addEventListener("pointercancel", finish, { once: true });
      }}
      className="-left-[14px] absolute top-0 hidden h-full w-[11px] cursor-col-resize items-center justify-center @3xl:flex"
    >
      <span
        aria-hidden
        className="h-[34px] w-[2px] rounded-[2px] bg-cc-rule3"
      />
    </button>
  );
}

/**
 * What the column is showing, in words.
 *
 * The artboard says "12 courses match “x”", counting the whole catalogue behind
 * its own mock store. The server cannot answer that question: `search.courses`
 * returns one page and reports `total` as the length of that page, and its
 * department and rating filters run *after* the fetch, so the set it returns can
 * be shorter than the set that matches (#74). "Showing" is the smallest edit
 * that keeps the sentence true.
 */
function resultsLabel(explore: ReturnType<typeof useExplore>): string {
  if (explore.isError) return "Catalogue unavailable";
  if (explore.isLoading) return "Loading courses…";
  // Nothing searched: the artboard counts its whole mock catalogue here, and
  // `StartHere` says what this column is for instead of repeating it.
  if (!explore.hasQuery) return "";
  const count = explore.results.length;
  if (count === 0) return `No courses for “${explore.query}”`;
  return `Showing ${count} course${count === 1 ? "" : "s"} for “${explore.query}”`;
}

/** The artboard's boxed message, dashed for an empty set and solid otherwise. */
function Panel({
  dashed,
  children,
}: {
  dashed?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-[12px] border bg-cc-surface px-[22px] py-[26px] text-center ${
        dashed ? "border-cc-rule3 border-dashed" : "border-cc-rule2"
      }`}
    >
      {children}
    </div>
  );
}

const SUGGESTIONS = ["machine learning", "DD2380", "linear algebra"];

/**
 * The no-query state.
 *
 * The artboard fills this moment by listing the whole catalogue, which it can do
 * because its mock store *is* the catalogue. `search.courses` returns nothing for
 * an empty query — it is an embedding search, and there is no embedding of
 * "nothing" — so the page would otherwise open on a blank column under a search
 * box. It says what to type instead, in the words the no-results state already
 * uses, and offers three searches that run on one click.
 */
function StartHere({ onSuggest }: { onSuggest: (query: string) => void }) {
  return (
    <Panel dashed>
      <div className="font-semibold text-[14.5px]">
        Search the KTH catalogue
      </div>
      <div className="mt-[5px] text-[13px] text-cc-muted">
        Start with a course code, a subject, or something you want to learn.
      </div>
      <div className="mt-[15px] flex flex-wrap items-center justify-center gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onSuggest(suggestion)}
            className="flex h-[30px] cursor-pointer items-center rounded-[8px] border border-cc-rule3 bg-cc-surface px-3 font-medium text-[12.5px] text-cc-chip-ink hover:border-cc-hov"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </Panel>
  );
}

/**
 * The artboard's error panel.
 *
 * Its tinted circle has no token — `cc-theme.css` carries no error surface —
 * so the fill is mixed from `--cc-danger` rather than pinned to the artboard's
 * `#fbeceb`, which is a light-mode hex that would go invisible on the dark
 * page.
 */
function ResultsError({ onRetry }: { onRetry: () => void }) {
  return (
    <Panel>
      <span
        className="inline-flex size-[34px] items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--cc-danger)_12%,var(--cc-surface))] text-cc-danger"
        aria-hidden
      >
        <TriangleAlert size={17} strokeWidth={2.2} />
      </span>
      <div className="mt-3 font-semibold text-[15.5px]">
        The course catalogue did not answer
      </div>
      <div className="mt-1.5 text-[13px] text-cc-muted leading-[1.5]">
        Search is unavailable right now. Your saved courses and collections are
        untouched.
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="mt-[15px] inline-flex h-[38px] cursor-pointer items-center gap-2 rounded-[9px] bg-cc-btn px-4 font-semibold text-[13px] text-cc-btn-fg"
      >
        <RotateCcw size={15} strokeWidth={1.9} aria-hidden />
        Try again
      </button>
    </Panel>
  );
}

const SKELETON_KEYS = ["s0", "s1", "s2"] as const;

/** Three cards' worth of the artboard's own loading skeleton. */
function ResultsSkeleton() {
  return (
    <>
      {SKELETON_KEYS.map((key, index) => (
        <div
          key={key}
          data-testid="explore-skeleton"
          className="flex h-[236px] shrink-0 rounded-[12px] border border-cc-rule2 bg-cc-surface"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-3.5 p-3.5">
            <div className="h-[15px] w-[46%] animate-pulse rounded-[5px] bg-cc-rule" />
            <div className="h-[11px] w-[30%] animate-pulse rounded-[4px] bg-cc-pill" />
            <div
              className="h-[11px] animate-pulse rounded-[4px] bg-cc-pill"
              style={{ width: `${86 - (index + 1) * 9}%` }}
            />
            <div className="h-[11px] w-[64%] animate-pulse rounded-[4px] bg-cc-pill" />
            <div className="mt-auto flex gap-2">
              <div className="h-[34px] w-[96px] animate-pulse rounded-[8px] bg-cc-pill" />
              <div className="h-[34px] w-[128px] animate-pulse rounded-[8px] bg-cc-pill" />
            </div>
          </div>
          <div className="flex w-[152px] shrink-0 flex-col gap-3 rounded-r-[11px] border-cc-rule border-l bg-cc-pg p-3.5">
            <div className="h-[11px] w-[80%] animate-pulse self-end rounded-[4px] bg-cc-pill" />
            <div className="h-[26px] w-[56%] animate-pulse rounded-[5px] bg-cc-rule" />
            <div className="h-[5px] w-full animate-pulse rounded-[3px] bg-cc-pill" />
            <div className="h-[5px] w-full animate-pulse rounded-[3px] bg-cc-pill" />
          </div>
        </div>
      ))}
    </>
  );
}

const SELECT_CLASS =
  "h-[34px] cursor-pointer rounded-[8px] border border-cc-rule3 bg-cc-surface px-2.5 font-medium text-[12.5px] text-cc-chip-ink hover:border-cc-hov focus-visible:outline-cc-brand";

/**
 * The department and rating filters.
 *
 * The artboard draws no filter row, so these follow its own control vocabulary —
 * a 34px pill in `--cc-surface` over `--cc-rule3` — rather than inventing a
 * treatment. They are native selects: the row is two one-click choices, and a
 * native control is keyboard- and screen-reader-correct on every platform
 * without a portal.
 *
 * The rating threshold is sent in **stars**. `search/service.ts` converts it to
 * the 1-10 scale learning scores are stored on, and it thresholds the learning
 * mean alone — workload is not a verdict, so averaging it in would rank a
 * punishing course like a rewarding one (#67).
 */
function Filters({ explore }: { explore: ReturnType<typeof useExplore> }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <select
        aria-label="School"
        value={explore.department}
        onChange={(event) => explore.onDepartmentChange(event.target.value)}
        className={SELECT_CLASS}
      >
        <option value="">All schools</option>
        {explore.departments.map((department) => (
          <option key={department} value={department}>
            {department}
          </option>
        ))}
      </select>

      <select
        aria-label="Minimum rating"
        title="How much reviewers said they learned, in stars"
        value={explore.minRatingStars ?? ""}
        onChange={(event) =>
          explore.onMinRatingChange(
            event.target.value ? Number(event.target.value) : null,
          )
        }
        className={SELECT_CLASS}
      >
        <option value="">Any rating</option>
        {RATING_STAR_OPTIONS.map((stars) => (
          <option key={stars} value={stars}>
            {stars === MAX_RATING_STARS ? `${stars} stars` : `${stars}+ stars`}
          </option>
        ))}
      </select>

      {explore.hasFilters ? (
        <button
          type="button"
          onClick={explore.onClearFilters}
          className="h-[34px] cursor-pointer rounded-[8px] px-2.5 font-medium text-[12.5px] text-cc-brand hover:underline"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
