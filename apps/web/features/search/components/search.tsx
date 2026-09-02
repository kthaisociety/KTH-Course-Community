"use client";

import { SearchIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Rating, RatingButton } from "@/components/ui/shadcn-io/rating";
import { Spinner } from "@/components/ui/spinner";
import {
  getMockChartData,
  getMockCourseStats,
  getMockKeywords,
  getMockPrerequisites,
  getMockSummary,
} from "@/data/courseCardMockData";
import {
  CourseCardWithCharts,
  CourseDetailsSidebar,
  CourseItemSkeleton,
} from "@/features/courses";
import { useSearchPage } from "../hooks/use-search-page";

const SKELETON_KEYS = ["s0", "s1", "s2", "s3", "s4"] as const;

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

function useResizableSidebar() {
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
      window.removeEventListener("pointercancel", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const resetWidth = () => {
    hasCustomizedRef.current = false;
    localStorage.removeItem(SIDEBAR_WIDTH_STORAGE_KEY);
    setWidth(bounds.default);
  };

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

export function Search() {
  const {
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
  } = useSearchPage();

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
      <form
        onSubmit={onSubmit}
        className="flex shrink-0 items-center justify-center gap-4 px-6 pb-6"
      >
        <InputGroup className="w-72">
          <InputGroupInput
            type="text"
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            placeholder="Search course..."
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton type="submit" size="icon-xs" aria-label="Search">
              {isLoading ? <Spinner /> : <SearchIcon />}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </form>
      {error && (
        <Alert
          variant="destructive"
          className="mx-auto mb-4 max-w-4xl shrink-0"
        >
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

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
                  <SelectGroup>
                    <SelectItem value="EECS">EECS</SelectItem>
                    <SelectItem value="ABE">ABE</SelectItem>
                    <SelectItem value="CBH">CBH</SelectItem>
                    <SelectItem value="ITM">ITM</SelectItem>
                    <SelectItem value="SCI">SCI</SelectItem>
                  </SelectGroup>
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
                  <SelectGroup>
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
                              <RatingButton key={`star-${value}-${starId}`} />
                            ))}
                          </Rating>
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
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
                {SKELETON_KEYS.map((key) => (
                  <li key={key}>
                    <CourseItemSkeleton />
                  </li>
                ))}
              </ul>
            )}

            {!isLoading && results.length === 0 && (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <SearchIcon />
                  </EmptyMedia>
                  <EmptyTitle>No courses found</EmptyTitle>
                  <EmptyDescription>
                    Try a different search or clear filters.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}

            <ul className="flex flex-col gap-4">
              {results.map((course) => (
                <li key={course.courseCode}>
                  <CourseCardWithCharts
                    title={course.titleEng}
                    summary={getMockSummary(course.courseCode)}
                    courseCode={course.courseCode}
                    department={course.department}
                    hp={course.credits}
                    keywords={getMockKeywords(course.courseCode)}
                    prerequisites={getMockPrerequisites(course.courseCode)}
                    chartData={getMockChartData(course.courseCode)}
                    stats={getMockCourseStats(course.courseCode)}
                    isUserFavorite={course.isUserFavorite}
                    isSelected={
                      selectedCode?.toUpperCase() ===
                      course.courseCode.toUpperCase()
                    }
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

      <Drawer
        open={showDrawer}
        onOpenChange={(open) => {
          if (!open) onCloseDetails();
        }}
      >
        <DrawerContent className="h-[90vh] overflow-hidden">
          <DrawerTitle className="sr-only">Course details</DrawerTitle>
          {selectedCode && (
            <CourseDetailsSidebar
              courseCode={selectedCode}
              details={courseDetails}
              loading={courseDetailsLoading}
              error={courseDetailsError}
              onClose={onCloseDetails}
            />
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
