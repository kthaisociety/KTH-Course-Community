"use client";

/**
 * Where a signed-out reader's saved courses live.
 *
 * Browsing never needs an account, and neither does saving: the Saved artboard
 * models `localSaves` and `acctSaves` as two lists behind one page, and says
 * why — *"Guest saves have nowhere else to live, so they are kept under our own
 * key"* (`docs/design_ref/2026-09-06/Course Community - Saved.dc.html:322`).
 *
 * It holds course *codes* and nothing else. A code is the one thing about a
 * course this app can re-fetch everything else from, so a stored list cannot go
 * stale in any way worse than naming a course that no longer exists — which
 * `saved.tsx` already survives, because an account save whose `course.summary`
 * does not answer has always been possible.
 *
 * ## One key per course, not one key holding a list
 *
 * The artboard keeps its list as a JSON array under a single key, and this did
 * too until review found the consequence. A list under one key makes *every*
 * change a read-modify-write: to add one course you read the array, append, and
 * write the whole thing back. `localStorage` is shared by every tab on the
 * origin and offers no compare-and-swap and no transaction, so two tabs doing
 * that at once lose whichever read first — and the write that loses is
 * somebody's saved course. Guarding it with `navigator.locks` closed the window
 * only where that API exists, which left the same bug behind a browser check.
 *
 * A save is a flag on a course, so each one is its own key. Saving is
 * `setItem`, unsaving and retiring are `removeItem`, and every one of them is a
 * single atomic operation on a key no other course touches. Two tabs can now
 * save, unsave and import at the same time and none of them can erase another's
 * work, in every browser, with no lock. Reading enumerates the prefix, and a
 * read that races a write merely repaints.
 *
 * The value stored is a sequence number, so the list keeps the order courses
 * were saved in rather than whatever order the browser hands keys back.
 *
 * ## Why a store and not `useState`
 *
 * Two components read this list at once: the Saved page's own list, and the
 * Save button on every card anywhere in the app. They are not in one tree —
 * Explore's cards are nowhere near `/saved` — so a `useState` in either place
 * would let a save on one screen leave the other showing the old answer until
 * something unrelated re-rendered it.
 *
 * `useSyncExternalStore` is what React offers for exactly this shape, and it
 * wants a stable snapshot: returning a fresh array from `read()` on every call
 * is an infinite render loop, not a subtle inefficiency. So the parsed list is
 * cached here and replaced only when it actually changes.
 */

/** One key per saved course: `kth-cc:saved-course:DD2380`. */
export const GUEST_SAVE_PREFIX = "kth-cc:saved-course:";

/** Subscribers in this tab. Another tab arrives through `storage` instead. */
const listeners = new Set<() => void>();

/**
 * The last list handed out, so repeated reads are reference-equal.
 *
 * `null` means "not read yet", which is different from "read and empty" —
 * `EMPTY` is that. Distinguishing them is what stops the first read of an empty
 * store allocating a new array every render.
 */
let cache: readonly string[] | null = null;

const EMPTY: readonly string[] = Object.freeze([]);

/**
 * The order marker written with each save.
 *
 * Wall-clock, but never repeating within a tab: two saves in the same
 * millisecond would otherwise tie and sort arbitrarily. Across tabs the clock
 * is what orders them, which is as close to "when it was saved" as anything
 * here can get without coordination nobody needs for a display order.
 */
let lastIssued = 0;
function nextSequence(): number {
  lastIssued = Math.max(Date.now(), lastIssued + 1);
  return lastIssued;
}

function same(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((code, at) => code === b[at]);
}

/**
 * Every stored code, oldest save first.
 *
 * Every access to `localStorage` in this file is wrapped: it throws outright —
 * not returns null — in a browser set to block site data, and in Safari's
 * private mode. A reader who has turned storage off gets an app that cannot
 * remember their guest saves, which is the right failure; it is not an app that
 * refuses to render the page.
 */
export function readGuestSaves(): readonly string[] {
  let found: { code: string; at: number }[];
  try {
    const store = window.localStorage;
    found = [];
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index);
      if (!key?.startsWith(GUEST_SAVE_PREFIX)) continue;
      const code = key.slice(GUEST_SAVE_PREFIX.length);
      if (!code) continue;
      // Anything can write to this origin's storage. A value that is not a
      // number still marks the course as saved; it just sorts last, which is
      // better than dropping a save over its ordering hint.
      const at = Number(store.getItem(key));
      found.push({
        code,
        at: Number.isFinite(at) ? at : Number.MAX_SAFE_INTEGER,
      });
    }
  } catch {
    return cache ?? EMPTY;
  }

  found.sort((a, b) => a.at - b.at || a.code.localeCompare(b.code));
  const next: readonly string[] = found.length
    ? Object.freeze(found.map((entry) => entry.code))
    : EMPTY;
  if (cache && same(cache, next)) return cache;
  cache = next;
  return next;
}

/** Tells this tab's readers that the store moved. */
function announce(): void {
  cache = null;
  for (const listener of listeners) listener();
}

/**
 * Adds or removes one course.
 *
 * One key, one operation, no read — which is the whole point of the layout.
 * Nothing here can disturb a different course, so a second tab saving while
 * this one unsaves or imports cannot lose either write.
 */
export function setGuestSave(courseCode: string, saved: boolean): void {
  if (!courseCode) return;
  try {
    if (saved) {
      window.localStorage.setItem(
        `${GUEST_SAVE_PREFIX}${courseCode}`,
        String(nextSequence()),
      );
    } else {
      window.localStorage.removeItem(`${GUEST_SAVE_PREFIX}${courseCode}`);
    }
  } catch {
    // Storage is the authority and this write did not reach it, so the course
    // is not shown as saved — the same answer a full store gets, rather than a
    // filled button that no reload will honour. The page keeps working; only
    // the remembering is lost.
  }
  announce();
}

/**
 * Drops exactly the courses named, and keeps everything else.
 *
 * Called once the account writes have landed — the artboard's `runImport`
 * clears local storage in the same step that commits the merge, and comments
 * the ordering: *"the browser hand-off is cleared only now"* (line 594).
 * Clearing first would lose the list outright if the write then failed.
 *
 * **Named courses, not the whole list**, and one `removeItem` each. The
 * artboard can afford a wholesale `removeItem` there because its `localSaves`
 * is component state that nothing else writes; ours is shared storage, and an
 * import is a run of awaited network writes long enough for another tab to save
 * something that was never part of it.
 */
export function retireGuestSaves(codes: readonly string[]): void {
  if (!codes.length) return;
  try {
    for (const code of codes) {
      window.localStorage.removeItem(`${GUEST_SAVE_PREFIX}${code}`);
    }
  } catch {
    /* storage unavailable — nothing to retire from */
  }
  announce();
}

/**
 * Replaces the whole list.
 *
 * The one operation here that is not per-course, and so the one that can
 * clobber a concurrent save. It exists to seed a browser — which is what the
 * tests use it for — and production code has no business calling it: saving,
 * unsaving and importing are all expressed as the per-course operations above.
 */
export function writeGuestSaves(codes: readonly string[]): void {
  const wanted = [...new Set(codes)];
  try {
    const store = window.localStorage;
    for (const key of Object.keys(store)) {
      if (key.startsWith(GUEST_SAVE_PREFIX)) store.removeItem(key);
    }
    for (const code of wanted) {
      store.setItem(`${GUEST_SAVE_PREFIX}${code}`, String(nextSequence()));
    }
  } catch {
    /* storage unavailable */
  }
  announce();
}

/** `useSyncExternalStore`'s subscribe half. */
export function subscribeGuestSaves(onChange: () => void): () => void {
  listeners.add(onChange);
  // Another tab's write reaches this one only as a `storage` event, and it
  // arrives with the cache still holding the old list — so the cache is
  // dropped rather than trusted. A `null` key means the whole store was
  // cleared, which is everyone's business.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && !event.key.startsWith(GUEST_SAVE_PREFIX)) return;
    cache = null;
    onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * What the server renders.
 *
 * There is no such thing as a guest save on the server — the list is in one
 * browser — so the server snapshot is the empty list, and it must be the *same*
 * empty list every call for React to accept it.
 */
export function guestSavesServerSnapshot(): readonly string[] {
  return EMPTY;
}

/** Test seam: drops the parsed cache so a test can rewrite storage under it. */
export function resetGuestSavesCache(): void {
  cache = null;
}
