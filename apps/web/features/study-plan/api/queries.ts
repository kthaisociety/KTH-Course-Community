"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

/** Every KTH programme the ingest found, for setup. */
export function useProgrammes() {
  const trpc = useTRPC();
  return useQuery(
    trpc.programme.list.queryOptions(undefined, {
      staleTime: Number.POSITIVE_INFINITY,
    }),
  );
}

/** One programme's syllabi per intake and its rounds this academic year. */
export function useProgramme(code: string | null) {
  const trpc = useTRPC();
  return useQuery(
    trpc.programme.detail.queryOptions(
      { code: code ?? "" },
      { enabled: !!code, staleTime: Number.POSITIVE_INFINITY },
    ),
  );
}

export function useMasterRequirements(codes: readonly string[]) {
  const trpc = useTRPC();
  return useQuery(
    trpc.programme.masterRequirements.queryOptions(
      { codes: [...codes].sort() },
      {
        enabled: codes.length > 0,
        staleTime: Number.POSITIVE_INFINITY,
        placeholderData: keepPreviousData,
      },
    ),
  );
}

export function useDegreeProjects(codes: readonly string[]) {
  const trpc = useTRPC();
  return useQuery(
    trpc.programme.degreeProjects.queryOptions(
      { codes: [...codes].sort() },
      {
        enabled: codes.length > 0,
        staleTime: Number.POSITIVE_INFINITY,
        placeholderData: keepPreviousData,
      },
    ),
  );
}

/** Rounds, levels and prerequisites for the courses in a plan. Previous facts stay up while new codes load. */
export function usePlanFacts(codes: readonly string[]) {
  const trpc = useTRPC();
  const sorted = [...new Set(codes)].sort().slice(0, 400);
  return useQuery(
    trpc.course.planFacts.queryOptions(
      { courseCodes: sorted },
      {
        enabled: sorted.length > 0,
        staleTime: 10 * 60_000,
        placeholderData: keepPreviousData,
      },
    ),
  );
}

/** The signed-in reader's saved courses; a visitor's live in the browser (`useGuestSaves`). */
export function useSavedCodes(enabled: boolean) {
  const trpc = useTRPC();
  return useQuery(trpc.saved.list.queryOptions(undefined, { enabled }));
}

/** A small catalogue search for adding a course by code or name. */
export function useCourseSearch(q: string) {
  const trpc = useTRPC();
  const query = q.trim();
  return useQuery(
    trpc.search.courses.queryOptions(
      { q: query, size: 10 },
      {
        enabled: query.length >= 2,
        placeholderData: keepPreviousData,
        staleTime: 60_000,
      },
    ),
  );
}

/** This academic year's rounds of each course in a plan, from the courses' kth.se pages. */
export function useCurrentRounds(codes: readonly string[]) {
  const trpc = useTRPC();
  const sorted = [...new Set(codes)].sort().slice(0, 400);
  return useQuery(
    trpc.programme.rounds.queryOptions(
      { codes: sorted },
      {
        enabled: sorted.length > 0,
        staleTime: Number.POSITIVE_INFINITY,
        placeholderData: keepPreviousData,
      },
    ),
  );
}
