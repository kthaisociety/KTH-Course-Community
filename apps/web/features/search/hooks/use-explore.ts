"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { AuthReason } from "@/features/auth";
import { NO_COURSE_STATS, useCourseStats } from "@/features/courses";
import {
  type OpenCourseRequest,
  openCourseRequest,
} from "@/features/workspace";
import type { CourseStats, CourseSummary } from "@/types";
import {
  type ExploreFilters,
  toSearchCoursesInput,
  useDepartments,
  useSearchCourses,
} from "../api/queries";
import { useDebouncedQuery } from "./use-debounced-query";

/** The lowest and highest thresholds the rating dropdown offers, in stars. */
const MIN_RATING_STARS = 1;
export const MAX_RATING_STARS = 5;

/**
 * Every threshold the dropdown offers.
 *
 * The control renders this and `readStars` below accepts exactly it, so the two
 * cannot drift into a filter the reader can pick and the page then discards.
 */
export const RATING_STAR_OPTIONS = Array.from(
  { length: MAX_RATING_STARS - MIN_RATING_STARS + 1 },
  (_, index) => MIN_RATING_STARS + index,
);

/**
 * A star threshold as the URL can carry it, or `null` for "any rating".
 *
 * The URL is typed by hand as often as it is clicked, and `search.courses`
 * rejects anything outside 1-5, so an unusable value is dropped here rather than
 * turned into a failed request the reader cannot explain.
 */
function readStars(raw: string | null): number | null {
  const stars = Number(raw);
  return Number.isInteger(stars) &&
    stars >= MIN_RATING_STARS &&
    stars <= MAX_RATING_STARS
    ? stars
    : null;
}

export interface ExploreOptions {
  /**
   * Where a course named by `?open=` is sent. Explore hands it to the workspace
   * pane, which is the only place a course opens now that `/course/<code>` is a
   * redirect onto this very parameter.
   */
  onOpenCourse?: (request: OpenCourseRequest) => void;
}

/**
 * Everything Explore renders, and everything a click on it does.
 *
 * ## The query lives in two places on purpose
 *
 * The field owns what is being typed, because an input driven from the URL
 * cannot keep up with a keystroke. `?q=` owns what is being *searched*: it seeds
 * the field on arrival, so a link shared out of Explore — or handed over by the
 * landing page's hero — opens on the search it names rather than empty (#95),
 * and the debounced value is written back to it so the address bar always names
 * the results on screen. `router.replace` rather than `push`: a search that grew
 * a character at a time must not leave twelve entries in the reader's history.
 *
 * The two are reconciled by `writtenQuery`, which remembers the last value this
 * hook itself put in the URL. A `?q=` that differs from it changed from
 * *outside* — Back, Forward, or a link followed into the page — and the field
 * adopts it. Without that, the mirror would win every argument and quietly
 * undo a Back the moment the reader pressed it.
 *
 * The filters need none of this: each is one discrete click with nothing to keep
 * up with, so the URL simply drives them, and Back undoes a filter for free.
 *
 * What the two paths *do* share is `setParams`, and they write through it at
 * genuinely independent moments — see `issuedParams` for why a write cannot
 * simply read the URL it is about to change.
 *
 * ## `?open=` is an instruction, not state
 *
 * `?q=` and the filters describe the page; `?open=<code>&kind=details|review`
 * asks it to do something once. It arrives from the `/course/<code>` redirect
 * that replaced the course page (#68 §5), and it is handed straight to the
 * host's workspace and then taken back out of the URL — otherwise every reload
 * would reopen a tab the reader had closed. It goes through `setParams` like
 * every other write here rather than through a second `router.replace`, because
 * two independent writers on one query string is exactly the race
 * `issuedParams` exists to prevent.
 */
export function useExplore({ onOpenCourse }: ExploreOptions = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [authReason, setAuthReason] = useState<AuthReason | null>(null);

  const urlQuery = searchParams.get("q")?.trim() ?? "";
  const [field, setField] = useState(urlQuery);
  const [debouncedField, setDebouncedField] = useDebouncedQuery(field);
  const query = debouncedField.trim();

  /** The last `?q=` this hook wrote. Anything else in the URL came from outside. */
  const writtenQuery = useRef(urlQuery);

  const department = searchParams.get("department") ?? "";
  const minRatingStars = readStars(searchParams.get("rating"));

  const liveParams = searchParams.toString();

  /**
   * The query string this hook last asked the router for, while the URL has yet
   * to catch up with it.
   *
   * `router.replace` does not land in `searchParams` synchronously, so two
   * writes inside that window — a school picked while the typed query is still
   * inside its 300ms debounce — would each build a whole URL from the same
   * pre-write snapshot, and whichever landed second would drop the other's
   * parameter. The second write builds on this instead, so they compose.
   */
  const issuedParams = useRef<string | null>(null);

  // Any change in the URL — our own write landing, or the reader navigating —
  // makes `searchParams` the truth again, so the record is only ever consulted
  // inside the window it exists for. `liveParams` is the trigger rather than
  // something the body reads, which is the whole point of the effect.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the URL changing is the event
  useEffect(() => {
    issuedParams.current = null;
  }, [liveParams]);

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(issuedParams.current ?? liveParams);
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      const queryString = next.toString();
      issuedParams.current = queryString;
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
        scroll: false,
      });
    },
    [router, pathname, liveParams],
  );

  // What was searched here goes into the URL.
  useEffect(() => {
    if (writtenQuery.current === query) return;
    writtenQuery.current = query;
    setParams({ q: query || null });
  }, [query, setParams]);

  // And what arrives in the URL from anywhere else comes back into the field.
  // Claiming it as written first is what stops the two effects chasing each
  // other: whichever moves, the other sees its own value and stands down.
  useEffect(() => {
    if (writtenQuery.current === urlQuery) return;
    writtenQuery.current = urlQuery;
    setField(urlQuery);
    setDebouncedField(urlQuery);
  }, [urlQuery, setDebouncedField]);

  const requestedOpen = openCourseRequest(
    searchParams.get("open"),
    searchParams.get("kind"),
  );
  const requestedCode = requestedOpen?.courseCode ?? null;
  const requestedKind = requestedOpen?.kind ?? null;

  /**
   * The handler by reference, so the effect below fires on the *parameter*
   * arriving and not on the host re-rendering with a fresh closure — Explore
   * passes an inline arrow, so that closure is new on every render. Re-running
   * the effect would reopen a tab the reader may already have closed, in the
   * window before `router.replace` has taken the parameter back out of the URL.
   *
   * The write is an effect and not an assignment during render: a render React
   * discards must leave nothing behind, and this one is declared above the
   * effect that reads it, so on any commit the handler is current before it is
   * called.
   */
  const openHandler = useRef(onOpenCourse);
  useEffect(() => {
    openHandler.current = onOpenCourse;
  }, [onOpenCourse]);

  useEffect(() => {
    if (!requestedCode || !requestedKind) return;
    openHandler.current?.({ courseCode: requestedCode, kind: requestedKind });
    setParams({ open: null, kind: null });
  }, [requestedCode, requestedKind, setParams]);

  const filters: ExploreFilters = {
    department: department || undefined,
    minRatingStars: minRatingStars ?? undefined,
  };

  const search = useSearchCourses(toSearchCoursesInput(query, filters));
  const departments = useDepartments();

  const results: CourseSummary[] = query ? (search.data?.results ?? []) : [];

  // A fresh array every render, which costs nothing: react-query hashes a query
  // key by its contents, so the same codes are the same query.
  const stats = useCourseStats(results.map((course) => course.courseCode));
  const statsByCode: Record<string, CourseStats> = stats.data ?? {};

  const onQueryChange = useCallback((value: string) => setField(value), []);

  /** Enter, or the magnifier: skip the debounce and search what is typed now. */
  const onSubmit = useCallback(
    (event?: FormEvent) => {
      event?.preventDefault?.();
      setDebouncedField(field);
    },
    [field, setDebouncedField],
  );

  const onClearQuery = useCallback(() => {
    setField("");
    setDebouncedField("");
  }, [setDebouncedField]);

  /** A suggestion from the empty state runs immediately; nothing is half-typed. */
  const onSuggestQuery = useCallback(
    (value: string) => {
      setField(value);
      setDebouncedField(value);
    },
    [setDebouncedField],
  );

  const onDepartmentChange = useCallback(
    (value: string) => setParams({ department: value || null }),
    [setParams],
  );

  const onMinRatingChange = useCallback(
    (stars: number | null) =>
      setParams({ rating: stars ? String(stars) : null }),
    [setParams],
  );

  const onClearFilters = useCallback(
    () => setParams({ department: null, rating: null }),
    [setParams],
  );

  return {
    field,
    onQueryChange,
    onSubmit,
    onClearQuery,
    onSuggestQuery,

    query,
    hasQuery: query.length > 0,
    results,
    statsFor: (courseCode: string) =>
      statsByCode[courseCode] ?? NO_COURSE_STATS,
    // `isFetching`, not `isLoading`: `keepPreviousData` keeps the last results
    // mounted while the next request runs, and the column has to say so.
    isLoading: search.isFetching,
    isError: search.isError,
    onRetry: () => void search.refetch(),

    department,
    minRatingStars,
    departments: departments.data?.departments ?? [],
    onDepartmentChange,
    onMinRatingChange,
    onClearFilters,
    hasFilters: Boolean(department) || minRatingStars !== null,

    authReason,
    setAuthReason,
  };
}
