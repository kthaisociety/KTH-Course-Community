"use client";

import type { Period, Slot } from "./slots";

/**
 * The study plan, kept in this browser until the schema allows a table
 * (ADR 0011).
 *
 * One key per fact, never one JSON blob: two tabs editing different courses
 * must not overwrite each other, which is the lesson `saved/lib/guest-saves.ts`
 * records. The owner comes first in every key because a browser is shared —
 * the empty owner is the visitor, as in `workspace-storage.ts`.
 *
 *   kth-cc:plan:<owner>:setup             {"v":1,"programme":"CDATE","intake":"20252",…}
 *   kth-cc:plan:<owner>:at:<code>         {"v":1,"ay":2027,"p":3}   a placement, or a moved course
 *   kth-cc:plan:<owner>:out:<code>        {"v":1}                   left out of the plan
 *   kth-cc:plan:<owner>:ok:<code>:<rule>  {"v":1,"ay":2027,"p":3}   a dismissed check, for that slot only
 *
 * Nothing from Taken is written here — no grades, no credits. The plan stores
 * only the student's own intentions.
 */

export const PLAN_PREFIX = "kth-cc:plan:";

/** The keys an imported plan may write. Rule names carry hyphens ("not-passed"). */
export const IMPORTABLE_KEY =
  /^(setup|at:[A-Z0-9ÅÄÖ]+|out:[A-Z0-9ÅÄÖ]+|ok:[A-Z0-9ÅÄÖ]+:[a-z-]+(:\d+)?)$/;

export interface PlanSetup {
  programme: string | null;
  /** Admission term, e.g. "20242". */
  intake: string | null;
  /** Chosen master's programme: years 4–5 of a civilingenjör plan, or the next step after a bachelor's. */
  master: string | null;
  /** The programme's track (inriktning), as the plan heads it. */
  track: string | null;
  /** The master's track. */
  masterTrack: string | null;
  summer: boolean;
}

export interface PlanState {
  setup: PlanSetup | null;
  placements: Readonly<Record<string, Slot>>;
  leftOut: readonly string[];
  /** `<code>:<rule>` → the slot the check was dismissed for. */
  dismissed: Readonly<Record<string, Slot>>;
}

const EMPTY: PlanState = Object.freeze({
  setup: null,
  placements: {},
  leftOut: [],
  dismissed: {},
});

const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string; state: PlanState }>();

const isPeriod = (p: unknown): p is Period =>
  p === 1 || p === 2 || p === 3 || p === 4 || p === 5;

function slotFrom(value: unknown): Slot | null {
  if (!value || typeof value !== "object") return null;
  const { ay, p } = value as { ay?: unknown; p?: unknown };
  return typeof ay === "number" &&
    Number.isInteger(ay) &&
    ay > 1990 &&
    ay < 2100 &&
    isPeriod(p)
    ? { ay, p }
    : null;
}

function setupFrom(value: unknown): PlanSetup | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const text = (x: unknown) => (typeof x === "string" && x ? x : null);
  return {
    programme: text(v.programme),
    intake: text(v.intake),
    master: text(v.master),
    track: text(v.track),
    masterTrack: text(v.masterTrack),
    summer: v.summer === true,
  };
}

function parse(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Every key of one owner's plan, as one string, so an unchanged plan returns the same snapshot. */
function rawFor(owner: string): string {
  const prefix = `${PLAN_PREFIX}${owner}:`;
  const parts: string[] = [];
  try {
    const store = window.localStorage;
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key?.startsWith(prefix))
        parts.push(
          `${key.slice(prefix.length)}\u0000${store.getItem(key) ?? ""}`,
        );
    }
  } catch {
    return "";
  }
  return parts.sort().join("\u0001");
}

export function readPlan(owner: string): PlanState {
  const raw = rawFor(owner);
  const hit = cache.get(owner);
  if (hit && hit.raw === raw) return hit.state;
  if (!raw) {
    cache.set(owner, { raw, state: EMPTY });
    return EMPTY;
  }
  let setup: PlanSetup | null = null;
  const placements: Record<string, Slot> = {};
  const leftOut: string[] = [];
  const dismissed: Record<string, Slot> = {};
  for (const part of raw.split("\u0001")) {
    const [key, value] = part.split("\u0000");
    const parsed = parse(value);
    if (key === "setup") setup = setupFrom(parsed);
    else if (key.startsWith("at:")) {
      const slot = slotFrom(parsed);
      if (slot) placements[key.slice(3)] = slot;
    } else if (key.startsWith("out:")) leftOut.push(key.slice(4));
    else if (key.startsWith("ok:")) {
      const slot = slotFrom(parsed);
      if (slot) dismissed[key.slice(3)] = slot;
    }
  }
  const state = { setup, placements, leftOut: leftOut.sort(), dismissed };
  cache.set(owner, { raw, state });
  return state;
}

export const planServerSnapshot = (): PlanState => EMPTY;

function announce() {
  for (const l of listeners) l();
}

export function subscribePlan(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key.startsWith(PLAN_PREFIX)) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function write(owner: string, key: string, value: object | null) {
  try {
    const full = `${PLAN_PREFIX}${owner}:${key}`;
    if (value === null) window.localStorage.removeItem(full);
    else window.localStorage.setItem(full, JSON.stringify({ v: 1, ...value }));
  } catch {
    // Storage is full or blocked: the plan simply doesn't remember this change.
  }
  announce();
}

export const planStore = {
  saveSetup: (owner: string, setup: PlanSetup) => write(owner, "setup", setup),
  place: (owner: string, code: string, slot: Slot | null) =>
    write(owner, `at:${code}`, slot),
  leaveOut: (owner: string, code: string, out: boolean) =>
    write(owner, `out:${code}`, out ? {} : null),
  dismiss: (owner: string, key: string, slot: Slot) =>
    write(owner, `ok:${key}`, slot),
  /** Every key of the owner's plan, for export. */
  exportPlan(owner: string): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const prefix = `${PLAN_PREFIX}${owner}:`;
    try {
      const store = window.localStorage;
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i);
        if (key?.startsWith(prefix))
          out[key.slice(prefix.length)] = parse(store.getItem(key));
      }
    } catch {
      /* nothing to export */
    }
    return out;
  },
  /** Replaces the owner's plan with an exported one, keeping only keys this store understands. */
  importPlan(owner: string, data: Record<string, unknown>) {
    const prefix = `${PLAN_PREFIX}${owner}:`;
    try {
      const store = window.localStorage;
      for (const key of Object.keys(store))
        if (key.startsWith(prefix)) store.removeItem(key);
      for (const [key, value] of Object.entries(data)) {
        if (!IMPORTABLE_KEY.test(key)) continue;
        if (!value || typeof value !== "object") continue;
        store.setItem(prefix + key, JSON.stringify(value));
      }
    } catch {
      /* storage blocked */
    }
    announce();
  },
  /** Removes the owner's whole plan. */
  clear(owner: string) {
    const prefix = `${PLAN_PREFIX}${owner}:`;
    try {
      const store = window.localStorage;
      for (const key of Object.keys(store))
        if (key.startsWith(prefix)) store.removeItem(key);
    } catch {
      /* storage blocked */
    }
    announce();
  },
};
