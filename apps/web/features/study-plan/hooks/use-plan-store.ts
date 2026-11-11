"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  planServerSnapshot,
  planStore,
  readPlan,
  subscribePlan,
} from "../lib/plan-storage";

/**
 * One owner's plan as React state, re-read whenever this or another tab
 * writes it. `useSyncExternalStore`, as `useGuestSaves` does, because the
 * store lives outside React and must not tear during a concurrent render.
 */
export function usePlanStore(owner: string) {
  const read = useCallback(() => readPlan(owner), [owner]);
  const state = useSyncExternalStore(subscribePlan, read, planServerSnapshot);
  const actions = useMemo(
    () => ({
      saveSetup: (setup: Parameters<typeof planStore.saveSetup>[1]) =>
        planStore.saveSetup(owner, setup),
      place: (code: string, slot: Parameters<typeof planStore.place>[2]) =>
        planStore.place(owner, code, slot),
      leaveOut: (code: string, out: boolean) =>
        planStore.leaveOut(owner, code, out),
      dismiss: (key: string, slot: Parameters<typeof planStore.dismiss>[2]) =>
        planStore.dismiss(owner, key, slot),
      exportPlan: () => planStore.exportPlan(owner),
      importPlan: (data: Record<string, unknown>) =>
        planStore.importPlan(owner, data),
      clear: () => planStore.clear(owner),
    }),
    [owner],
  );
  return { state, ...actions };
}
