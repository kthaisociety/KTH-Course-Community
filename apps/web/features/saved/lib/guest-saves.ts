"use client";

/**
 * Where a signed-out reader's saved courses live.
 *
 * Browsing never needs an account, and neither does saving: the Saved artboard
 * models `localSaves` and `acctSaves` as two lists behind one page, and says
 * why — *"Guest saves have nowhere else to live, so they are kept under our own
 * key"* (`docs/design_ref/2026-09-06/Course Community - Saved.dc.html:322`).
 * This is that key. The name is the artboard's own, at line 212 of the same
 * file, so a browser that used the prototype and a browser that used the app
 * are holding the same list under the same name.
 *
 * It holds course *codes* and nothing else. A code is the one thing about a
 * course this app can re-fetch everything else from, so a stored list cannot go
 * stale in any way worse than naming a course that no longer exists — which
 * `saved.tsx` already survives, because an account save whose `course.summary`
 * does not answer has always been possible.
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

/** The artboard's key, kept verbatim. */
export const GUEST_SAVES_KEY = "kth-cc:saved-courses";

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

/** Course codes as stored, or `EMPTY` if the store is unusable or unset. */
function parse(raw: string | null): readonly string[] {
  if (!raw) return EMPTY;
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return EMPTY;
    // A stored list is only as trustworthy as the last thing that wrote it,
    // and anything can write to `localStorage` under this origin. Codes that
    // are not strings are dropped rather than rendered.
    const codes = value.filter(
      (code): code is string => typeof code === "string" && code.length > 0,
    );
    return codes.length ? Object.freeze([...new Set(codes)]) : EMPTY;
  } catch {
    return EMPTY;
  }
}

function same(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((code, at) => code === b[at]);
}

/**
 * The stored codes.
 *
 * Every access to `localStorage` in this file is wrapped: it throws outright —
 * not returns null — in a browser set to block site data, and in Safari's
 * private mode. A reader who has turned storage off gets an app that cannot
 * remember their guest saves, which is the right failure; it is not an app that
 * refuses to render the page.
 */
export function readGuestSaves(): readonly string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(GUEST_SAVES_KEY);
  } catch {
    return cache ?? EMPTY;
  }
  const next = parse(raw);
  if (cache && same(cache, next)) return cache;
  cache = next;
  return next;
}

/** Replaces the stored list and tells this tab's readers. */
export function writeGuestSaves(codes: readonly string[]): void {
  const next = Object.freeze([...new Set(codes)]);
  cache = next.length ? next : EMPTY;
  try {
    if (next.length) {
      window.localStorage.setItem(GUEST_SAVES_KEY, JSON.stringify(next));
    } else {
      // An empty list is stored as no list. It means the same thing on the way
      // back in, and it leaves nothing behind for a reader who unsaved
      // everything.
      window.localStorage.removeItem(GUEST_SAVES_KEY);
    }
  } catch {
    // Storage is the authority, and this write did not reach it. When it is
    // blocked outright the reads throw too, so the cache above is what serves
    // this tab and saving keeps working until the tab closes. When it is merely
    // full, the reads still work and the next one drops this save — which is
    // the honest answer, and better than showing a course as saved that no
    // reload will bring back.
  }
  for (const listener of listeners) listener();
}

/** Adds or removes one code, and answers with the list that resulted. */
export function setGuestSave(
  courseCode: string,
  saved: boolean,
): readonly string[] {
  const current = readGuestSaves();
  const next = saved
    ? current.includes(courseCode)
      ? current
      : [...current, courseCode]
    : current.filter((code) => code !== courseCode);
  if (same(current, next)) return current;
  writeGuestSaves(next);
  return readGuestSaves();
}

/**
 * Drops the whole list.
 *
 * Called only once the account write it was handed to has landed — the
 * artboard's `runImport` clears local storage in the same step that commits the
 * merge, and comments the ordering: *"the browser hand-off is cleared only
 * now"* (line 594). Clearing first would lose the list outright if the write
 * then failed.
 */
export function clearGuestSaves(): void {
  writeGuestSaves(EMPTY);
}

/** `useSyncExternalStore`'s subscribe half. */
export function subscribeGuestSaves(onChange: () => void): () => void {
  listeners.add(onChange);
  // Another tab's write reaches this one only as a `storage` event, and it
  // arrives with the cache still holding the old parse — so the cache is
  // dropped rather than trusted.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== GUEST_SAVES_KEY) return;
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
