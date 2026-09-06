import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSearchBarHandoff,
  SEARCH_MORPH_KEY,
  SEARCH_MORPH_MAX_AGE_MS,
  stashSearchBarHandoff,
  takeSearchBarHandoff,
} from "./search-morph";

/**
 * The handoff is the only thing that crosses the landing → Explore navigation,
 * and every rule about *when it does not* lives here: consumed once, never
 * stale, never trusted. The animation itself is covered where it runs
 * (`components/search-morph.spec.tsx`); this suite is the storage contract.
 */

function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

let store: Storage;

beforeEach(() => {
  store = fakeStorage();
  vi.stubGlobal("window", { sessionStorage: store });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const BAR = { left: 120, top: 400, width: 560, height: 42 };

describe("stashSearchBarHandoff", () => {
  it("writes the bar's box with the moment it was measured", () => {
    stashSearchBarHandoff(BAR, 1_000);

    expect(JSON.parse(store.getItem(SEARCH_MORPH_KEY) ?? "null")).toEqual({
      x: 120,
      y: 400,
      w: 560,
      h: 42,
      t: 1_000,
    });
  });

  it("survives a store that refuses to be written to", () => {
    vi.stubGlobal("window", {
      sessionStorage: {
        ...store,
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
      },
    });

    expect(() => stashSearchBarHandoff(BAR)).not.toThrow();
  });

  it("does nothing where there is no window at all", () => {
    vi.stubGlobal("window", undefined);

    expect(() => stashSearchBarHandoff(BAR)).not.toThrow();
    expect(takeSearchBarHandoff()).toBeNull();
  });
});

describe("takeSearchBarHandoff", () => {
  it("returns the stashed box", () => {
    stashSearchBarHandoff(BAR, 1_000);

    expect(takeSearchBarHandoff(1_100)).toEqual({
      x: 120,
      y: 400,
      w: 560,
      h: 42,
      t: 1_000,
    });
  });

  it("consumes it: a second read, and so a reload of Explore, gets nothing", () => {
    stashSearchBarHandoff(BAR, 1_000);

    expect(takeSearchBarHandoff(1_100)).not.toBeNull();
    expect(takeSearchBarHandoff(1_100)).toBeNull();
    expect(store.getItem(SEARCH_MORPH_KEY)).toBeNull();
  });

  it("ignores a rect older than the bound, and still consumes it", () => {
    stashSearchBarHandoff(BAR, 1_000);

    expect(
      takeSearchBarHandoff(1_000 + SEARCH_MORPH_MAX_AGE_MS + 1),
    ).toBeNull();
    expect(store.getItem(SEARCH_MORPH_KEY)).toBeNull();
  });

  it("accepts a rect right on the bound", () => {
    stashSearchBarHandoff(BAR, 1_000);

    expect(
      takeSearchBarHandoff(1_000 + SEARCH_MORPH_MAX_AGE_MS),
    ).not.toBeNull();
  });

  it("ignores a stamp from the future, because the clock moved", () => {
    stashSearchBarHandoff(BAR, 5_000);

    expect(takeSearchBarHandoff(1_000)).toBeNull();
  });

  it("returns nothing when nothing was stashed", () => {
    expect(takeSearchBarHandoff()).toBeNull();
  });

  it.each([
    ["not JSON at all", "{"],
    ["not an object", '"nope"'],
    ["null", "null"],
    ["missing the timestamp", '{"x":1,"y":2,"w":560,"h":42}'],
    ["carrying a NaN", '{"x":null,"y":2,"w":560,"h":42,"t":1}'],
    ["zero-sized", '{"x":1,"y":2,"w":0,"h":0,"t":1}'],
  ])("rejects a value that is %s, and clears it out", (_case, raw) => {
    store.setItem(SEARCH_MORPH_KEY, raw);

    expect(takeSearchBarHandoff(1)).toBeNull();
    expect(store.getItem(SEARCH_MORPH_KEY)).toBeNull();
  });

  it("survives a store that refuses to be read", () => {
    vi.stubGlobal("window", {
      sessionStorage: {
        ...store,
        getItem: () => {
          throw new Error("SecurityError");
        },
      },
    });

    expect(takeSearchBarHandoff()).toBeNull();
  });
});

describe("clearSearchBarHandoff", () => {
  it("removes a pending rect", () => {
    stashSearchBarHandoff(BAR, 1_000);
    clearSearchBarHandoff();

    expect(store.getItem(SEARCH_MORPH_KEY)).toBeNull();
  });

  it("survives a store that refuses to be written to", () => {
    vi.stubGlobal("window", {
      sessionStorage: {
        ...store,
        removeItem: () => {
          throw new Error("SecurityError");
        },
      },
    });

    expect(() => clearSearchBarHandoff()).not.toThrow();
  });
});
