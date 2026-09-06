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

export interface ExploreOptions {
  /**
   * Where a course named by `?open=` is sent. Explore hands it to the workspace
   * pane, which is the only place a course opens now that `/course/<code>` is a
   * redirect onto this very parameter.
   */
  onOpenCourse?: (request: OpenCourseRequest) => void;
}

/** `?page=` as the hook reads it: a positive integer, or the first page. */
function pageFromParam(raw: string | null): number {
  if (!raw) return 1;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return 1;
  return parsed;
}

/**
 * Everything Explore renders, and everything a click on it does.
 *
 * ## The query lives in two places on purpose
 *
 * The field owns what is being typed, because an input driven from the URL
 * cannot keep up with a keystroke. `?q=` owns what is being *searched*: it seeds
 * the field on arrival, so a link shared out of Explore — or handed over by the
 * landing page's hero — opens on the search it names rather than empty,
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
 * The school filter needs none of this: it is one discrete click with nothing to
 * keep up with, so the URL simply drives it, and Back undoes a filter for free.
 * It is also the only filter left; `department` below says what went and why.
 *
 * `?page=` is driven the same way, and is the one write here that *pushes*
 * rather than replaces, because turning a page is a navigation the reader
 * expects Back to undo. It is also the one piece of state this hook does not
 * have the last word on: the server caps how deep Explore may page and says
 * which page it served, so `requestedPage` below is what was asked for and
 * `page` is what was answered.
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

  /**
   * School, the only filter.
   *
   * `?rating=` is deliberately not read, and deliberately not stripped either:
   * an old shared `?rating=4` link is simply a parameter this page ignores. It
   * opens on unfiltered results, with no error and no warning — a link somebody
   * sent months ago should still work, just without a filter this app does not
   * have. `server/search/service.ts` says why it does not have one.
   */
  const department = searchParams.get("department") ?? "";

  /**
   * The page asked for, which is not necessarily the page that comes back.
   *
   * Only the shape is checked here — a positive integer, anything else is page
   * one — because how *deep* Explore may page is the server's rule, not this
   * hook's. `server/search/service.ts` caps the depth (the semantic leg has no
   * relevance floor, so there is no honest bottom to page to) and echoes the
   * page it actually served. A hand-typed `?page=99` therefore lands on the
   * last page that exists, with the pager reading from the served page rather
   * than from the number in the address bar.
   *
   * Nothing rewrites `?page=` to match. An effect that corrected the URL from
   * the response would be an effect writing the very state it reads, which is
   * how the last three render loops in this repo started; the reader's next
   * click writes a truthful number and the stale one is gone.
   */
  const requestedPage = pageFromParam(searchParams.get("page"));

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
    (
      patch: Record<string, string | null>,
      options?: { history?: "push" | "replace" },
    ) => {
      const next = new URLSearchParams(issuedParams.current ?? liveParams);
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      const queryString = next.toString();
      issuedParams.current = queryString;
      const href = queryString ? `${pathname}?${queryString}` : pathname;
      // Everything on this page rewrites the URL it is already on — a search
      // grown a character at a time must not leave twelve entries in the
      // reader's history. Paging is the exception, and goes through the same
      // writer rather than a second `router.replace` of its own, because two
      // independent writers on one query string is the race `issuedParams`
      // exists to prevent. See `onNextPage` for why it pushes.
      if (options?.history === "push") router.push(href, { scroll: false });
      else router.replace(href, { scroll: false });
    },
    [router, pathname, liveParams],
  );

  // What was searched here goes into the URL. A new search starts at the first
  // page: page 3 of "graphs" is not page 3 of "compilers", and carrying the
  // number across would open the new search on an empty column.
  useEffect(() => {
    if (writtenQuery.current === query) return;
    writtenQuery.current = query;
    setParams({ q: query || null, page: null });
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

  /**
   * The request this hook has already spent, so it spends it exactly once.
   *
   * The render loop this once fed is closed at the value instead: `openCourse`
   * returns the very same `Workspace` for a no-op open, so `useState` bails out
   * rather than re-rendering the host, rebuilding `setParams` and re-running
   * the effect. See `features/workspace/lib/open-courses.ts`.
   *
   * The guard is belt-and-braces. It defends against a *second*
   * instruction rather than against the loop — the same `?open=` surviving one
   * more render before `router.replace` has taken it back out of the URL would
   * reopen a tab the reader may already have closed. Next's `router` is stable
   * in practice; nothing promises it, and a test double is not.
   *
   * It clears when the parameter goes, so the same course arriving again later
   * is a new instruction rather than one this hook thinks it has done.
   */
  const spentRequest = useRef<string | null>(null);

  useEffect(() => {
    if (!requestedCode || !requestedKind) {
      spentRequest.current = null;
      return;
    }
    const request = `${requestedKind}:${requestedCode}`;
    if (spentRequest.current === request) return;
    spentRequest.current = request;

    openHandler.current?.({ courseCode: requestedCode, kind: requestedKind });
    setParams({ open: null, kind: null });
  }, [requestedCode, requestedKind, setParams]);

  const filters: ExploreFilters = {
    department: department || undefined,
  };

  const search = useSearchCourses(
    toSearchCoursesInput(query, filters, requestedPage),
  );
  const departments = useDepartments();

  /**
   * The reply, but only when it is a reply to *this* request.
   *
   * `keepPreviousData` keeps the previous page mounted while the next one
   * loads, which is what stops the column flashing empty on every keystroke and
   * on every page turn. The rows are the point of that; `page` and `hasMore`
   * are not — they describe the request that produced them, so reading them off
   * a placeholder would say "page 1, no more" for the whole of the flight to
   * page 2 and flip the pager's buttons twice on the way.
   */
  const settled = search.isPlaceholderData ? undefined : search.data;

  const results: CourseSummary[] = query ? (search.data?.results ?? []) : [];

  /**
   * The page on screen: the one the server says it served, and the requested
   * one only while the answer is still in flight.
   *
   * They agree on every ordinary turn, and differ exactly when `?page=` was
   * past the depth cap — which is the case the echo exists for.
   */
  const page = settled?.page ?? requestedPage;
  const hasMore = settled?.hasMore ?? false;

  const goToPage = useCallback(
    (next: number) => {
      // `push`, not `replace`: turning a page is a deliberate navigation and
      // the reader expects Back to undo it, unlike a search grown a keystroke
      // at a time. Page one drops the parameter rather than writing `page=1`,
      // so the shared link for a first page is the one it always was.
      setParams({ page: next > 1 ? String(next) : null }, { history: "push" });
    },
    [setParams],
  );

  const onPrevPage = useCallback(() => {
    if (page > 1) goToPage(page - 1);
  }, [page, goToPage]);

  const onNextPage = useCallback(() => {
    if (hasMore) goToPage(page + 1);
  }, [page, hasMore, goToPage]);

  const onFirstPage = useCallback(() => goToPage(1), [goToPage]);

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

  // Both reset to the first page for the same reason the query mirror does:
  // narrowing to one school shortens the ranking, so page 3 of the unfiltered
  // search is very often past the end of the filtered one.
  const onDepartmentChange = useCallback(
    (value: string) => setParams({ department: value || null, page: null }),
    [setParams],
  );

  const onClearFilters = useCallback(
    () => setParams({ department: null, page: null }),
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

    page,
    /**
     * Whether the pager is drawn at all.
     *
     * The artboard shows it when `pageCount > 1`, which it can ask because its
     * mock store *is* the catalogue. There is no page count here and there
     * cannot be one, so this is that condition translated into what the data
     * supports: the control appears exactly when it can do something — when
     * there is a page after this one, or one before it.
     *
     * Never over the start-here panel or the error panel, though. A bare
     * `?page=3` with nothing searched, or a page whose request failed, has no
     * page to go back to — only a number in the address bar.
     */
    hasPager: query.length > 0 && !search.isError && (hasMore || page > 1),
    canPrevPage: page > 1,
    canNextPage: hasMore,
    onPrevPage,
    onNextPage,
    onFirstPage,

    department,
    departments: departments.data?.departments ?? [],
    onDepartmentChange,
    onClearFilters,
    hasFilters: Boolean(department),

    authReason,
    setAuthReason,
  };
}
