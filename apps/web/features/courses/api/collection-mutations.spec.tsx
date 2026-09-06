import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useCollectionMutations } from "./mutations";

/**
 * Two reorders in flight at once.
 *
 * A reader nudging a course twice quickly sends the second request before the
 * first has answered, and the two write the same cache entry. What the second
 * move shows must survive the first one failing: the server takes the whole
 * order from whichever request reaches it last, so an earlier failure says
 * nothing about the later move.
 */

const LIST_KEY = ["collections", "list"];

type Deferred = {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
};

const pending: Deferred[] = [];

/** Hands back a promise per call, so a test decides which settles and how. */
function nextRequest() {
  return new Promise((resolve, reject) => {
    pending.push({ resolve, reject });
  });
}

vi.mock("@/trpc/client", () => {
  const mutation = { mutationOptions: (options: object) => options };
  return {
    useTRPC: () => ({
      collections: {
        list: { queryKey: () => LIST_KEY },
        create: mutation,
        rename: mutation,
        delete: mutation,
        addCourse: mutation,
        removeCourse: mutation,
        reorder: {
          mutationOptions: (options: object) => ({
            ...options,
            mutationFn: () => nextRequest(),
          }),
        },
      },
    }),
  };
});

const COLLECTION = {
  id: "c1",
  name: "Spring",
  createdAt: "2026-01-01T00:00:00.000Z",
  courseCodes: ["AA1000", "BB2000", "CC3000"],
};

function setup() {
  pending.length = 0;
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  queryClient.setQueryData(LIST_KEY, [COLLECTION]);

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  const { result } = renderHook(() => useCollectionMutations(), {
    wrapper: Wrapper,
  });

  const order = () =>
    queryClient.getQueryData<Array<typeof COLLECTION>>(LIST_KEY)?.[0]
      ?.courseCodes;

  return { result, order };
}

describe("overlapping reorders", () => {
  it("keeps the newer move when the older request fails", async () => {
    const { result, order } = setup();

    // Nudge BB2000 up, then nudge it up again before the first answers.
    const first = result.current.reorder
      .mutateAsync({
        collectionId: "c1",
        courseCodes: ["BB2000", "AA1000", "CC3000"],
      })
      .catch(() => undefined);
    await waitFor(() => expect(pending).toHaveLength(1));

    const second = result.current.reorder
      .mutateAsync({
        collectionId: "c1",
        courseCodes: ["CC3000", "BB2000", "AA1000"],
      })
      .catch(() => undefined);
    await waitFor(() => expect(pending).toHaveLength(2));
    expect(order()).toEqual(["CC3000", "BB2000", "AA1000"]);

    // The first request fails. It knows nothing about the second move, so it
    // must not put the list back to how things were before either of them.
    pending[0]?.reject(new Error("network"));
    await first;
    expect(order()).toEqual(["CC3000", "BB2000", "AA1000"]);

    pending[1]?.resolve({
      collectionId: "c1",
      courseCodes: ["CC3000", "BB2000", "AA1000"],
    });
    await second;
    expect(order()).toEqual(["CC3000", "BB2000", "AA1000"]);
  });

  it("applies each move to what the one before it left", async () => {
    const { result, order } = setup();

    result.current.reorder
      .mutateAsync({
        collectionId: "c1",
        courseCodes: ["BB2000", "AA1000", "CC3000"],
      })
      .catch(() => undefined);
    await waitFor(() =>
      expect(order()).toEqual(["BB2000", "AA1000", "CC3000"]),
    );

    // The second nudge is computed from what is on screen, which is only the
    // first move's result because the cache already carries it.
    result.current.reorder
      .mutateAsync({
        collectionId: "c1",
        courseCodes: ["BB2000", "CC3000", "AA1000"],
      })
      .catch(() => undefined);
    await waitFor(() =>
      expect(order()).toEqual(["BB2000", "CC3000", "AA1000"]),
    );
  });
});
