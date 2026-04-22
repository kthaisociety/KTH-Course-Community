"use client";

import type { CourseDetails, CourseWithUserInfo } from "@shared/types";
import { SearchIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CourseCardWithCharts } from "@/components/CourseCardWithCharts";
import { CourseDetailsSidebar } from "@/components/CourseDetailsSidebar";
import { CourseItemSkeleton } from "@/components/CourseItemSkeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Rating, RatingButton } from "@/components/ui/shadcn-io/rating";
import { Spinner } from "@/components/ui/shadcn-io/spinner";
import {
  getMockChartData,
  getMockCourseStats,
  getMockKeywords,
  getMockPrerequisites,
  getMockSummary,
} from "@/data/courseCardMockData";

type SearchViewProps = {
  localQuery: string;
  setLocalQuery: (q: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
  isLoading: boolean;
  error: string | undefined;
  results: CourseWithUserInfo[];
  filters: Record<string, string | string[]>;
  onFiltersChange: (filters: Record<string, string | string[]>) => void;
  onCardClick: (courseCode: string) => void;
  onWriteReview: (courseCode: string) => void;
  onToggleFavorite: (courseCode: string) => void;
  onAddToComparison: (courseCode: string) => void;
  selectedCode: string | null;
  courseDetails: CourseDetails | null;
  courseDetailsLoading: boolean;
  courseDetailsError: string | null;
  onCloseDetails: () => void;
};

// Necessary for static arrays? Can't we just use the map index?
const skeletonKeys = Array.from({ length: 5 }, () => crypto.randomUUID());

/** Matches Tailwind's `lg` breakpoint (1024px). */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}

/** Sidebar width as viewport-relative fractions, with absolute px clamps
 *  so the panel stays usable on very narrow or ultra-wide displays. */
const SIDEBAR_MIN_VW = 0.28;
const SIDEBAR_MAX_VW = 0.55;
const SIDEBAR_DEFAULT_VW = 0.42;
const SIDEBAR_ABS_MIN_PX = 400;
const SIDEBAR_ABS_MAX_PX = 1200;
const SIDEBAR_WIDTH_STORAGE_KEY = "search:sidebarWidth";

type SidebarBounds = { min: number; max: number; default: number };

function getSidebarBounds(viewportWidth: number): SidebarBounds {
  return {
    min: Math.max(
      SIDEBAR_ABS_MIN_PX,
      Math.round(viewportWidth * SIDEBAR_MIN_VW),
    ),
    max: Math.min(
      SIDEBAR_ABS_MAX_PX,
      Math.round(viewportWidth * SIDEBAR_MAX_VW),
    ),
    default: Math.round(viewportWidth * SIDEBAR_DEFAULT_VW),
  };
}

/** Persisted, viewport-scaled sidebar width + a pointer-drag handle.
 *
 *  Width follows the viewport-scaled default until the user manually resizes
 *  (drag / keyboard / reset). Only user-initiated changes are persisted —
 *  mount-time clamping and viewport-resize adjustments don't touch storage,
 *  otherwise the initial default would be saved and shadow the vw-based
 *  default on every subsequent screen. */
function useResizableSidebar() {
  // Hardcoded fallback for SSR / first paint; replaced from viewport on mount.
  const [bounds, setBounds] = useState<SidebarBounds>({
    min: 400,
    max: 900,
    default: 720,
  });
  const [width, setWidth] = useState(720);
  const hasCustomizedRef = useRef(false);
  const asideRef = useRef<HTMLElement>(null);

  const persistWidth = (next: number) => {
    hasCustomizedRef.current = true;
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(next));
    setWidth(next);
  };

  // On mount: compute real bounds from the viewport, then apply any persisted width.
  useEffect(() => {
    const next = getSidebarBounds(window.innerWidth);
    setBounds(next);
    const stored = Number(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY));
    if (Number.isFinite(stored) && stored > 0) {
      hasCustomizedRef.current = true;
      setWidth(Math.max(next.min, Math.min(next.max, stored)));
    } else {
      setWidth(next.default);
    }
  }, []);

  // On viewport resize: recompute bounds. If the user hasn't customized, follow
  // the new vw-scaled default; otherwise just re-clamp their chosen width.
  useEffect(() => {
    const update = () => {
      const next = getSidebarBounds(window.innerWidth);
      setBounds(next);
      setWidth((w) => {
        if (!hasCustomizedRef.current) return next.default;
        return Math.max(next.min, Math.min(next.max, w));
      });
    };
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const onHandlePointerDown = (e: React.PointerEvent) => {
    if (!asideRef.current) return;
    e.preventDefault();
    const asideRight = asideRef.current.getBoundingClientRect().right;

    const onMove = (ev: PointerEvent) => {
      const next = Math.max(
        bounds.min,
        Math.min(bounds.max, asideRight - ev.clientX),
      );
      persistWidth(next);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  const nudgeWidth = (delta: number) => {
    const next = Math.max(bounds.min, Math.min(bounds.max, width + delta));
    persistWidth(next);
  };

  return {
    width,
    bounds,
    asideRef,
    onHandlePointerDown,
    resetWidth,
    nudgeWidth,
  };
}

export default function SearchView({
  localQuery,
  setLocalQuery,
  onSubmit,
  isLoading,
  error,
  results,
  filters,
  onFiltersChange,
  onCardClick,
  onWriteReview,
  onToggleFavorite,
  onAddToComparison,
  selectedCode,
  courseDetails,
  courseDetailsLoading,
  courseDetailsError,
  onCloseDetails,
}: SearchViewProps) {
  const isDesktop = useIsDesktop();
  const showSidebarAside = Boolean(selectedCode) && isDesktop;
  const showDrawer = Boolean(selectedCode) && !isDesktop;
  const {
    width: sidebarWidth,
    bounds: sidebarBounds,
    asideRef,
    onHandlePointerDown,
    resetWidth,
    nudgeWidth,
  } = useResizableSidebar();

  // Slide/fade presence for the desktop aside: we delay unmount by the
  // transition duration so the exit animation can play, and keep the last
  // valid course code around so the content doesn't disappear mid-animation.
  const [asideMounted, setAsideMounted] = useState(false);
  const [asideOpen, setAsideOpen] = useState(false);
  const [displayCode, setDisplayCode] = useState<string | null>(null);

  useEffect(() => {
    if (showSidebarAside && selectedCode) {
      setDisplayCode(selectedCode);
      setAsideMounted(true);
      const raf = requestAnimationFrame(() => setAsideOpen(true));
      return () => cancelAnimationFrame(raf);
    }
    setAsideOpen(false);
    const timer = setTimeout(() => {
      setAsideMounted(false);
      setDisplayCode(null);
    }, 150);
    return () => clearTimeout(timer);
  }, [showSidebarAside, selectedCode]);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden pt-6">
      {/* Search bar — stays in place while either pane scrolls. */}
      <form
        onSubmit={onSubmit}
        className="flex shrink-0 items-center justify-center gap-4 px-6 pb-6"
      >
        <input
          className="rounded-md outline p-2 w-64 text-center"
          type="text"
          value={localQuery}
          onChange={(e) => setLocalQuery(e.target.value)}
          placeholder="Search course..."
        />
        <Button variant="outline" className="h-10 w-10 p-0">
          {isLoading ? <Spinner variant="ring" /> : <SearchIcon />}
        </Button>
      </form>
      {error && (
        <p className="shrink-0 pb-4 text-center text-red-600">Error: {error}</p>
      )}

      {/* Two independently scrolling panes. Sidebar sits near the viewport's right edge with a small gap.
          No `gap-6` here: the gap lives on the aside as a transitioning `margin-left`
          so it can collapse to 0 alongside the width during the open/close animation. */}
      <div className="flex min-h-0 flex-1 w-full pb-6 pr-4">
        <div className="scrollbar-subtle flex min-h-0 flex-1 flex-col overflow-y-auto pl-6">
          <div className="mx-auto flex w-full max-w-4xl flex-col">
            <div className="flex shrink-0 items-center gap-4 mb-6">
              <Select
                value={(filters.department as string) || ""}
                onValueChange={(value) => {
                  const newFilters = { ...filters };
                  newFilters.department = value;
                  onFiltersChange(newFilters);
                }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="School..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EECS">EECS</SelectItem>
                  <SelectItem value="ABE">ABE</SelectItem>
                  <SelectItem value="CBH">CBH</SelectItem>
                  <SelectItem value="ITM">ITM</SelectItem>
                  <SelectItem value="SCI">SCI</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={(filters.minRating as string) || ""}
                onValueChange={(value) => {
                  const newFilters = { ...filters };
                  newFilters.minRating = value;
                  onFiltersChange(newFilters);
                }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Minimum Rating..." />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }).map((_, ratingValue) => {
                    const value = ratingValue + 1;
                    return (
                      <SelectItem
                        key={`selectitem-${value}`}
                        value={value.toString()}
                      >
                        <Rating value={value} readOnly>
                          {(
                            ["one", "two", "three", "four", "five"] as const
                          ).map((starId) => (
                            <RatingButton
                              key={`star-${value}-${starId}`}
                              className="text-yellow-600"
                            />
                          ))}
                        </Rating>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              {Object.keys(filters).length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onFiltersChange({})}
                  className="text-sm"
                >
                  Clear Filters
                </Button>
              )}
            </div>
            {isLoading && (
              <ul className="flex flex-col gap-4">
                {skeletonKeys.map((key) => (
                  <li key={key}>
                    <CourseItemSkeleton />
                  </li>
                ))}
              </ul>
            )}

            <ul className="flex flex-col gap-4">
              {results.map((course) => (
                <li key={course.courseCode}>
                  <CourseCardWithCharts
                    title={course.titleEng}
                    goals={""}
                    content={""}
                    summary={getMockSummary(course.courseCode)}
                    courseCode={course.courseCode}
                    department={course.department}
                    hp={course.credits}
                    keywords={getMockKeywords(course.courseCode)}
                    prerequisites={getMockPrerequisites(course.courseCode)}
                    chartData={getMockChartData(course.courseCode)}
                    stats={getMockCourseStats(course.courseCode)}
                    isUserFavorite={course.isUserFavorite}
                    isSelected={selectedCode === course.courseCode}
                    onCardClick={() => onCardClick(course.courseCode)}
                    onWriteReview={() => onWriteReview(course.courseCode)}
                    onToggleFavorite={() => onToggleFavorite(course.courseCode)}
                    onAddToComparison={() =>
                      onAddToComparison(course.courseCode)
                    }
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>

        {asideMounted && displayCode && (
          <aside
            ref={asideRef}
            style={{
              width: asideOpen ? sidebarWidth : 0,
              marginLeft: asideOpen ? "1.5rem" : 0,
            }}
            className={`relative hidden h-full shrink-0 transition-[width,margin-left,opacity] duration-150 ease-out lg:block ${
              asideOpen ? "opacity-100" : "opacity-0"
            }`}
          >
            {/* Resize handle: thin hit-zone on the aside's left edge. */}
            {/* biome-ignore lint/a11y/useSemanticElements: <hr> cannot contain the visible handle bar */}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize course details panel (double-click to reset)"
              aria-valuenow={sidebarWidth}
              aria-valuemin={sidebarBounds.min}
              aria-valuemax={sidebarBounds.max}
              tabIndex={0}
              onPointerDown={onHandlePointerDown}
              onDoubleClick={resetWidth}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") nudgeWidth(16);
                else if (e.key === "ArrowRight") nudgeWidth(-16);
                else if (e.key === "Home") resetWidth();
              }}
              className="absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize group focus-visible:outline-none"
            >
              <div className="pointer-events-none mx-auto h-full w-px bg-border transition-colors group-hover:w-0.5 group-hover:bg-primary group-active:bg-primary group-focus-visible:bg-primary" />
            </div>
            <CourseDetailsSidebar
              courseCode={displayCode}
              details={courseDetails}
              loading={courseDetailsLoading}
              error={courseDetailsError}
              onClose={onCloseDetails}
            />
          </aside>
        )}
      </div>

      <Dialog
        open={showDrawer}
        onOpenChange={(open) => {
          if (!open) onCloseDetails();
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="h-[90vh] max-w-[calc(100%-1rem)] p-0 overflow-hidden gap-0"
        >
          <DialogTitle className="sr-only">Course details</DialogTitle>
          {selectedCode && (
            <CourseDetailsSidebar
              courseCode={selectedCode}
              details={courseDetails}
              loading={courseDetailsLoading}
              error={courseDetailsError}
              onClose={onCloseDetails}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
