"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import {
  type GuestSave,
  guestSavesServerSnapshot,
  readGuestSaves,
  retireGuestSaves,
  setGuestSave,
  snapshotGuestSaves,
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
 * The four states are the Saved artboard's own:
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
 * scenario poser, seeding a preview fixture; the control a reader actually
 * sees is the `pendingImport` row's "Add to my account" button. That
 * is also the safer of the two: signing in is not consent to write a list of
 * courses to an account, and somebody who signed in on a shared browser should
 * not silently inherit whatever the last person saved on it.
 *
 * Codes leave the browser only after the account write for them has landed —
 * the artboard's own ordering, and the reason a failure here is recoverable:
 * whatever did not land is still in the browser, the banner says so, and the
 * button is still there.
 *
 * **Only the saves this run imported leave.** `localStorage` is shared by every
 * tab on the origin and the writes below are awaited, so the list can change
 * underneath a run in progress; the snapshot taken at the top is what gets
 * retired, never "whatever storage holds now". It is a snapshot of saves rather
 * than of codes because another tab can unsave and re-save the same course
 * meanwhile, and only the marker distinguishes that new save from the one this
 * run imported. `retireGuestSaves` compares each marker back against storage
 * and leaves behind anything that has moved.
 *
 * **Every snapshotted code is written, including ones the account looks like it
 * already has.** `accountCodes` is the `user.me` cache behind the page, and
 * that cache is optimistic: `useSetCourseSaved` puts a code into it before the
 * account has answered and takes it back out if the write is rejected. Treating
 * the cache as proof would retire the browser's copy of such a code without
 * writing anything of its own, and a rolled-back earlier write then leaves the
 * course in neither place. So the cache decides only the number the banner
 * reports, never what leaves the browser. `saved.save` is idempotent
 * (`insertSavedCourse` uses `onConflictDoNothing`), so a redundant write costs
 * one request and changes nothing, which is a great deal cheaper than the
 * course it was losing.
 *
 * That is also what makes `retireGuestSaves` safe to accept its marker compare
 * being two operations rather than one: every code it is handed has a resolved
 * account write of this run's own behind it, so a mistimed delete can only cost
 * a duplicate.
 */
export function useGuestSavesImport() {
  const [state, setState] = useState<GuestImportState>({ status: "idle" });
  const guestCodes = useGuestSaves();

  const run = useCallback(async ({ accountCodes, save }: ImportOptions) => {
    const local = snapshotGuestSaves();
    if (!local.length) {
      setState({ status: "idle" });
      return;
    }

    setState({ status: "running" });
    // What the reader is told was added. A display count and nothing else: it
    // reads the optimistic cache, so it can be off by a course whose earlier
    // write has not answered yet, and being off by one in a banner is the whole
    // cost of that. Nothing about what leaves the browser is decided here.
    const added = local.filter(
      ({ code }) => !accountCodes.includes(code),
    ).length;
    // What this run has actually put in the account, in order. Built as the
    // writes land rather than assumed from the list, because a run that fails
    // half way has genuinely imported the half that already answered — and
    // because a resolved write is the only evidence that retiring is safe.
    const imported: GuestSave[] = [];

    try {
      for (const entry of local) {
        await save(entry.code);
        imported.push(entry);
      }
    } catch {
      // What landed is retired; what did not is left exactly where it was, so
      // the offer stands, the retry writes only what is still missing, and
      // nothing is lost either way.
      retireGuestSaves(imported);
      setState({ status: "failed" });
      return;
    }

    // The snapshot, not the current list: a save made in another tab during the
    // awaits above is in storage and was never part of this import, and
    // retiring it would delete a save that no account ever received.
    retireGuestSaves(imported);
    setState(added ? { status: "done", count: added } : { status: "dupes" });
  }, []);

  const dismiss = useCallback(() => setState({ status: "idle" }), []);

  return { state, run, dismiss, guestCodes };
}

/** Toggling one course for a signed-out reader. */
export function toggleGuestSave(courseCode: string, saved: boolean): void {
  setGuestSave(courseCode, saved);
}
