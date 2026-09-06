"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import {
  clearGuestSaves,
  guestSavesServerSnapshot,
  readGuestSaves,
  setGuestSave,
  subscribeGuestSaves,
} from "../lib/guest-saves";

/**
 * The signed-out reader's saved courses, as React state.
 *
 * `useSyncExternalStore` rather than an effect: the store is shared by every
 * card in the app and by the Saved page, and this is the hook that exists to
 * subscribe to something outside React without tearing during a concurrent
 * render.
 */
export function useGuestSaves(): readonly string[] {
  return useSyncExternalStore(
    subscribeGuestSaves,
    readGuestSaves,
    guestSavesServerSnapshot,
  );
}

/**
 * How far the hand-off from browser to account has got.
 *
 * The four states are the Saved artboard's own, at
 * `docs/design_ref/2026-09-06/Course Community - Saved.dc.html:747-752`:
 * `pending` is its `pendingImport` row, and `running` / `done` / `dupes` are
 * the three `aria-live` banners above it. `dupes` is a state rather than a
 * flavour of `done` because it says something different — nothing was added,
 * and that is not a failure.
 */
export type GuestImportState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "done"; count: number }
  | { status: "dupes" }
  | { status: "failed" };

type ImportOptions = {
  /** The account's codes, so the ones already there can be told apart. */
  accountCodes: readonly string[];
  /** The one write path. Sequential, because it queues per course anyway. */
  save: (courseCode: string) => Promise<unknown>;
};

/**
 * Moves the guest list into the account, once the reader asks.
 *
 * **Asked, not automatic.** The artboard auto-runs this only in its own
 * scenario poser (line 578, seeding a preview fixture); the control a reader
 * actually sees is the `pendingImport` row's "Add to my account" button. That
 * is also the safer of the two: signing in is not consent to write a list of
 * courses to an account, and somebody who signed in on a shared browser should
 * not silently inherit whatever the last person saved on it.
 *
 * The local list is cleared only after every write has landed — the artboard's
 * own ordering, and the reason a failure here is recoverable: the codes are
 * still in the browser, the banner says so, and the button is still there.
 */
export function useGuestSavesImport() {
  const [state, setState] = useState<GuestImportState>({ status: "idle" });
  const guestCodes = useGuestSaves();

  const run = useCallback(async ({ accountCodes, save }: ImportOptions) => {
    const local = readGuestSaves();
    if (!local.length) {
      setState({ status: "idle" });
      return;
    }

    setState({ status: "running" });
    // Only what the account does not already hold is written. The rest is
    // not an error and not a duplicate write — it is the same course saved
    // twice, once in each place, and the account's copy already won.
    const fresh = local.filter((code) => !accountCodes.includes(code));

    try {
      for (const code of fresh) await save(code);
    } catch {
      // The list is untouched, so the offer stands and the reader can press
      // the button again. Clearing here is what would lose it.
      setState({ status: "failed" });
      return;
    }

    clearGuestSaves();
    setState(
      fresh.length
        ? { status: "done", count: fresh.length }
        : { status: "dupes" },
    );
  }, []);

  const dismiss = useCallback(() => setState({ status: "idle" }), []);

  return { state, run, dismiss, guestCodes };
}

/** Toggling one course for a signed-out reader. */
export function toggleGuestSave(courseCode: string, saved: boolean): void {
  setGuestSave(courseCode, saved);
}
