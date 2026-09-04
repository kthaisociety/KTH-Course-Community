"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Scoped to the account, not to the origin. Two people sharing a browser get
 * their own answer: an unscoped key would hand the second one the first one's
 * choice about their own grades.
 */
const storageKeyFor = (userId: string) => `cc:myPage:showAverage:${userId}`;

/**
 * Whether My Page works an average out of the grades it has.
 *
 * **This is the one piece of state on the page with nowhere to live.** `users`
 * has no preference column and no procedure writes one, so the switch is kept
 * in the browser, under a key scoped to the app user's own id. That is not the mistake `cc-store.js`
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
export function useAveragePreference(userId: string): {
  showAverage: boolean;
  setShowAverage: (next: boolean) => void;
} {
  // Starts at the default on both server and first client render, then settles
  // to the stored value in an effect. Reading storage during render would
  // hydrate a different tree than the server sent.
  const [showAverage, setState] = useState(true);

  useEffect(() => {
    // Back to the default first: signing in as somebody else must not leave
    // the previous account's answer on screen while this one is read.
    setState(true);
    if (!userId) return;
    try {
      const stored = window.localStorage.getItem(storageKeyFor(userId));
      if (stored !== null) setState(stored === "true");
    } catch {
      // Storage is off. The default stands.
    }
  }, [userId]);

  const setShowAverage = useCallback(
    (next: boolean) => {
      setState(next);
      if (!userId) return;
      try {
        window.localStorage.setItem(storageKeyFor(userId), String(next));
      } catch {
        // Storage is off, so the choice lasts as long as this page does.
      }
    },
    [userId],
  );

  return { showAverage, setShowAverage };
}
