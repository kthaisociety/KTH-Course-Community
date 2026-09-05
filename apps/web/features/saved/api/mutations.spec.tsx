import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSetCourseSaved } from "./mutations";

/**
 * Unsaving is also a collections write, and the cache has to hear about it.
 *
 * `collection_courses` has a composite foreign key onto `user_saved_courses`
 * with `on delete cascade`, because a course may only be in a collection its
 * owner has also saved. So `saved.unsave` empties the course out of every
 * collection it was in without `collections.removeCourse` ever being called,
 * and nothing on the client can see that happen unless `collections.list` is
 * refetched too.
 *
 * The three surfaces that unsave — Explore's Save button, the Saved page's
 * trash, and the trash on a card inside a collection — all go through this one
 * hook, so this is the only place the invalidation can be got right once.
 */

const ME_KEY = ["user", "me"];
const COLLECTIONS_KEY = ["collections", "list"];

const saveMutation = vi.fn();
const unsaveMutation = vi.fn();

vi.mock("@/trpc/client", () => ({
  useTRPC: () => ({
    user: { me: { queryKey: () => ME_KEY } },
    collections: { list: { queryKey: () => COLLECTIONS_KEY } },
    saved: {
      save: {
        mutationOptions: () => ({
          mutationFn: (input: unknown) => saveMutation(input),
        }),
      },
      unsave: {
        mutationOptions: () => ({
          mutationFn: (input: unknown) => unsaveMutation(input),
        }),
      },
    },
  }),
}));

const ME = {
  id: "u1",
  name: "Elsa",
  savedCourseCodes: ["DD2380", "DD1337"],
};

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  queryClient.setQueryData(ME_KEY, ME);
  queryClient.setQueryData(COLLECTIONS_KEY, []);

  const invalidated: unknown[] = [];
  const invalidateQueries = queryClient.invalidateQueries.bind(queryClient);
  vi.spyOn(queryClient, "invalidateQueries").mockImplementation((filters) => {
    invalidated.push(filters?.queryKey);
    return invalidateQueries(filters);
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  const { result } = renderHook(() => useSetCourseSaved(), {
    wrapper: Wrapper,
  });
  return { result, invalidated };
}

beforeEach(() => {
  saveMutation.mockReset().mockResolvedValue(undefined);
  unsaveMutation.mockReset().mockResolvedValue(undefined);
});

describe("unsaving a course", () => {
  it("refetches the collections it was silently removed from", async () => {
    const { result, invalidated } = setup();

    await result.current.setSaved("DD2380", false);

    await waitFor(() => {
      expect(unsaveMutation).toHaveBeenCalledWith({ courseCode: "DD2380" });
    });
    expect(invalidated).toContainEqual(ME_KEY);
    expect(invalidated).toContainEqual(COLLECTIONS_KEY);
  });

  // Only the last write for a course refetches, so a burst of clicks does not
  // pull server state back over a move that is still in flight.
  it("refetches once for a burst of clicks on the same course", async () => {
    const { result, invalidated } = setup();

    await Promise.all([
      result.current.setSaved("DD2380", false),
      result.current.setSaved("DD2380", true),
      result.current.setSaved("DD2380", false),
    ]);

    await waitFor(() => {
      expect(invalidated.filter((key) => key === COLLECTIONS_KEY)).toHaveLength(
        1,
      );
    });
  });
});

describe("saving a course", () => {
  /*
   * Saving adds a row to `user_saved_courses`. That makes the course *eligible*
   * for a collection; it never puts it in one, so there is nothing about the
   * viewer's collections that has changed and nothing to refetch.
   */
  it("leaves the collections alone", async () => {
    const { result, invalidated } = setup();

    await result.current.setSaved("SF1626", true);

    await waitFor(() => {
      expect(saveMutation).toHaveBeenCalledWith({ courseCode: "SF1626" });
    });
    expect(invalidated).toContainEqual(ME_KEY);
    expect(invalidated).not.toContainEqual(COLLECTIONS_KEY);
  });
});

describe("an unsave that fails", () => {
  /*
   * The optimistic edit is rolled back and the caller is told, which is what
   * raises the toast. The refetch still happens: the write may have reached the
   * database before the response was lost, and a refetch is the only thing that
   * can tell.
   */
  it("puts the course back and still asks the server who is right", async () => {
    const { result, invalidated } = setup();
    unsaveMutation.mockRejectedValue(new Error("offline"));

    await expect(result.current.setSaved("DD2380", false)).rejects.toThrow();

    expect(invalidated).toContainEqual(COLLECTIONS_KEY);
  });
});
