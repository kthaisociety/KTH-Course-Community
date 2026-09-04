"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "cc:myPage:showAverage";

/**
 * Whether My Page works an average out of the grades it has.
 *
 * **This is the one piece of state on the page with nowhere to live.** `users`
 * has no preference column and no procedure writes one, so the switch is kept
 * per browser rather than per account. That is not the mistake `cc-store.js`
 * makes with `likedReviewIds`: votes have a `review_votes` table and belong on
 * the server, whereas this is a display choice over grades the account already
 * stores, and the average itself is derived at read time either way. Nothing
 * about a viewer's data changes when it is flipped.
 *
 * It follows that the switch does not sync across devices, which the page says
 * out loud rather than implying otherwise. A `users` column would fix that and
 * is server work, outside #93.
 *
 * The default is on, which is the artboard's own initial state. Reads and
 * writes are wrapped because storage can be unavailable — a private window, or
 * a browser set to block site data — and a page that cannot remember a switch
 * must still render it.
 */
export function useAveragePreference(): {
  showAverage: boolean;
  setShowAverage: (next: boolean) => void;
} {
  // Starts at the default on both server and first client render, then settles
  // to the stored value in an effect. Reading storage during render would
  // hydrate a different tree than the server sent.
  const [showAverage, setState] = useState(true);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored !== null) setState(stored === "true");
    } catch {
      // Storage is off. The default stands.
    }
  }, []);

  const setShowAverage = useCallback((next: boolean) => {
    setState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // Storage is off, so the choice lasts as long as this page does.
    }
  }, []);

  return { showAverage, setShowAverage };
}
