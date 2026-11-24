import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { planStore, readPlan } from "./plan-storage";

/**
 * A localStorage double: items are own enumerable properties, as on the real
 * Storage, because `importPlan` and `clear` walk `Object.keys(store)`.
 */
function memoryStorage(): Storage {
  const store = {} as Storage & Record<string, string>;
  const items = () => Object.keys(store);
  Object.defineProperties(store, {
    length: { get: () => items().length },
    key: { value: (i: number) => items()[i] ?? null },
    getItem: { value: (k: string) => (k in store ? store[k] : null) },
    setItem: {
      value: (k: string, v: string) => {
        store[k] = String(v);
      },
    },
    removeItem: {
      value: (k: string) => {
        delete store[k];
      },
    },
    clear: {
      value: () => {
        for (const k of items()) delete store[k];
      },
    },
  });
  return store;
}

const g = globalThis as unknown as { window?: { localStorage: Storage } };

beforeEach(() => {
  g.window = { localStorage: memoryStorage() };
});
afterEach(() => {
  delete g.window;
});

const setup = {
  programme: "CINTE",
  intake: "20242",
  master: "TMAIM",
  track: null,
  masterTrack: null,
  summer: false,
};

describe("plan export and import", () => {
  it("carries a plan from one owner to another, setup, moves, left-out courses and dismissals alike", () => {
    planStore.saveSetup("user-1", setup);
    planStore.place("user-1", "DD2352", { ay: 2027, p: 3 });
    planStore.leaveOut("user-1", "IV1013", true);
    planStore.dismiss("user-1", "DD1420:prerequisite", { ay: 2027, p: 1 });

    // Through JSON, as the file does.
    const file = JSON.parse(JSON.stringify(planStore.exportPlan("user-1")));
    planStore.importPlan("", file);

    expect(readPlan("")).toEqual(readPlan("user-1"));
    expect(readPlan("").placements).toEqual({ DD2352: { ay: 2027, p: 3 } });
    expect(readPlan("").leftOut).toEqual(["IV1013"]);
  });

  it("resets to the syllabus, keeping the setup and where passed courses were taken", () => {
    planStore.saveSetup("", setup);
    planStore.place("", "SF1625", { ay: 2024, p: 1 }); // passed
    planStore.place("", "DD2352", { ay: 2027, p: 3 }); // an added elective
    planStore.leaveOut("", "IV1013", true);
    planStore.dismiss("", "DD1420:prerequisite", { ay: 2027, p: 1 });

    planStore.reset("", new Set(["SF1625"]));

    const plan = readPlan("");
    expect(plan.setup?.programme).toBe("CINTE");
    expect(plan.placements).toEqual({ SF1625: { ay: 2024, p: 1 } });
    expect(plan.leftOut).toEqual([]);
    expect(plan.dismissed).toEqual({});
  });

  it("exports only the owner's own plan", () => {
    planStore.saveSetup("user-1", setup);
    planStore.place("user-2", "SF2930", { ay: 2028, p: 1 });
    expect(Object.keys(planStore.exportPlan("user-1"))).toEqual(["setup"]);
  });

  it("replaces the plan it imports over, and keeps only keys it understands", () => {
    planStore.saveSetup("", setup);
    planStore.place("", "SF1625", { ay: 2024, p: 1 });

    planStore.importPlan("", {
      setup: { ...setup, programme: "CDATE" },
      "at:DD2352": { v: 1, ay: 2027, p: 3 },
      "evil:key": { v: 1 },
      "at:DH2642": "not an object",
    });

    const plan = readPlan("");
    expect(plan.setup?.programme).toBe("CDATE");
    expect(plan.placements).toEqual({ DD2352: { ay: 2027, p: 3 } });
    expect(Object.keys(planStore.exportPlan("")).sort()).toEqual([
      "at:DD2352",
      "setup",
    ]);
  });
});
