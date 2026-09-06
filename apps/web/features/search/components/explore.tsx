"use client";

import { RotateCcw, Search as SearchIcon, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useRef } from "react";
import { AuthReasonDialog } from "@/features/auth";
import { CourseCardItem, courseCardGeometry } from "@/features/courses";
import { PageColumn, PageHeader, useSearchBarArrival } from "@/features/shell";
import {
  MobileWorkspaceSheetHost,
  useResultsWidth,
  useWorkspacePane,
  useWorkspacePresentation,
  WorkspacePaneHost,
} from "@/features/workspace";
import {
  MAX_RATING_STARS,
  RATING_STAR_OPTIONS,
  useExplore,
} from "../hooks/use-explore";

/**
 * Explore: the search-and-browse workspace, and the app's front door to the
 * catalogue.
 *
 * From `docs/design_ref/2026-09-06/Course Community - Explore.dc.html`. Three things
 * about it are this page's alone:
 *
 * - **It owns the course card's collapse ramp.** `courseCardGeometry` turns the
 *   measured results-column width into the card's `geo`; the artboard computes
 *   the same ramp off the width the workspace pane leaves behind (line 1061).
 *   The card measures nothing, which is why the geometry is a prop.
 * - **It is where a course opens.** #68 §5 retired the course page, so
 *   `/course/<code>` now redirects here carrying `?open=<code>&kind=…` and the
 *   pane is the only surface that shows a course. Nothing on this page routes
 *   away to read one.
 * - **It is fully open to visitors.** Searching, browsing and reading reviews
 *   never need an account. Only saving and taking do, and those prompts live on
 *   the card — so nothing here gates the page, and the one `AuthReasonDialog`
 *   the whole list hands off to is rendered at the bottom of this component.
 *
 * ## Where it departs from the artboard, and why
 *
 * - The artboard's **pager** (lines 263-265) is not built, and stays unbuilt by
 *   decision: it is **#148**. `search.courses` accepts a `page` input and
 *   ignores it, and returns `total: results.length` — the count of what it just
 *   returned. A pager over that would invent pages that do not exist, which is
 *   the same error class as scoring an unreviewed course 0%. The real fix is a
 *   `COUNT` query and an honoured offset in the search domain, which is server
 *   work; nothing here should grow a pager over the contract as it stands.
 * - The artboard's **filter row does not exist** at all; its search block is the
 *   field alone. #89 requires filters, so they are built here in the artboard's
 *   own control vocabulary.
 * - The artboard narrows its **search bar** by 236px while tabs are open
 *   (`searchBarMargin`, line 1351) so the field stays centred over the results
 *   rather than over the whole row. Not built: the bar is centred inside a
 *   `max-w-[560px]` box that is already narrower than the results column at
 *   every width the pane can open at, so the correction has nothing to correct.
 * - The artboard's **shared-element handoff from the landing hero** (its
 *   `pickUpSharedBar()`, line 856) *is* built, and is the one place in the app
 *   authorised to improve on the artboard rather than match it.
 *   `useSearchBarArrival` below is the receiving end: when this mount is
 *   continuing a search the reader submitted on `/`, the bar animates out of the
 *   box it occupied there while the shell's rail slides in from the left on the
 *   same spring, and the regions marked `data-cc-fade` — everything here that
 *   was not on the landing — come up behind it. Arriving any other way (a shared
 *   link, a bookmark, the rail) is not continuing a gesture, and gets no
 *   animation at all. `@/features/shell`'s `search-morph` owns the seam, because
 *   the rail is the shell's and only the shell can hand it over.
 */
export function Explore() {
  const workspace = useWorkspacePane();
  const explore = useExplore({
    onOpenCourse: (request) => workspace.open(request.courseCode, request.kind),
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const presentation = useWorkspacePresentation(containerRef);
  const rowRef = useRef<HTMLDivElement>(null);
  const [resultsRef, resultsWidth] = useResultsWidth();
  const geo = courseCardGeometry(resultsWidth);
  // The bar the landing hands over, and the subtree the arrival looks in for the
  // surroundings that fade up behind it.
  const barRef = useRef<HTMLFormElement>(null);
  useSearchBarArrival(barRef, containerRef);

  const { results, hasQuery, isLoading, isError } = explore;
  const showEmpty = hasQuery && !isLoading && !isError && results.length === 0;

  return (
    <PageColumn
      className="h-full min-h-0 overflow-hidden"
      contentClassName="h-full min-h-0 pb-0"
      containerRef={containerRef}
    >
      {/* Wrapped only to be marked: `PageHeader` is one block used by every
          page and takes no styling of its own. */}
      <div data-cc-fade>
        <PageHeader
          title="Explore courses"
          subtitle="Search the KTH catalogue and see what students said about a course before you pick it."
        />
      </div>

      <search className="flex shrink-0 flex-col items-center gap-2.5 px-6 pt-[18px] pb-3.5">
        <form
          ref={barRef}
          onSubmit={explore.onSubmit}
          className="w-full max-w-[560px]"
        >
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

      <div
        ref={rowRef}
        data-cc-fade
        className="flex min-h-0 flex-1 gap-[18px] px-5 pb-5"
      >
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
                onOpen={() => workspace.open(course.courseCode, "details")}
                onReview={() => workspace.open(course.courseCode, "review")}
                onRequestAuth={explore.setAuthReason}
              />
            ))}
          </div>
        </div>

        {/* Two presentations of one open list, and never both at once: the
            column until the container has been measured as narrow, the sheet
            after. See `useWorkspacePresentation` for why `null` is not
            "narrow". */}
        {presentation === "sheet" ? null : (
          <WorkspacePaneHost
            rowRef={rowRef}
            openCourses={workspace.openCourses}
            activeId={workspace.activeId}
            onActivate={workspace.activate}
            onClose={workspace.close}
            onOpen={workspace.open}
          />
        )}
      </div>

      {presentation === "sheet" ? (
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
 * Its tinted circle is the danger tint family, not a derivation of the solid.
 * This comment used to claim `cc-theme.css` carried no error surface and mix
 * the fill from `--cc-danger` at 12%; that was wrong twice over. The Design
 * System artboard names `--dangerTint` as *the* error banner surface
 * (`Course Community - Design System.dc.html:175-177`, alongside its border and
 * its ink), and none of the three is derivable from the solid — dark states
 * them as alpha over the page, light as flat mixes that are not a percentage of
 * anything (`globals.css:182-187`, #127 §1). In light the difference showed:
 * the mix landed on a pink, the token is a warm peach.
 *
 * The icon takes `--cc-danger-ink` for the same reason, and it is also literally
 * what the artboard draws — `Course Community - Explore.dc.html:243` strokes it
 * `#a3452a`, which is the ink, over the tint. Neither hex is pinned here: both
 * are light-mode values that would go invisible on the dark page.
 */
function ResultsError({ onRetry }: { onRetry: () => void }) {
  return (
    <Panel>
      <span
        className="inline-flex size-[34px] items-center justify-center rounded-full bg-cc-danger-tint text-cc-danger-ink"
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
    // `data-cc-fade`: the filter row was not on the landing page, so it comes up
    // behind the arriving search bar rather than being there before it lands.
    <div
      data-cc-fade
      className="flex flex-wrap items-center justify-center gap-2"
    >
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
