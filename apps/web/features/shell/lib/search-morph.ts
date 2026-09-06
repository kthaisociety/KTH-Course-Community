/**
 * The landing → Explore search-bar handoff: the one measurement that survives
 * the navigation.
 *
 * `/` and `/search` are separate routes, so the landing's tree unmounts before
 * Explore's mounts. There is no component alive on both sides and no shared
 * parent for a `layoutId` to bridge, which is why this is FLIP rather than a
 * layout animation: the landing writes down the box its search bar occupied at
 * the moment of submit, and Explore animates its own bar out of that box into
 * the place it was already standing.
 *
 * It works because the two bars are the same element in every visual respect —
 * `h-[42px]`, `rounded-[10px]`, `border border-cc-rule3`, `bg-cc-surface`,
 * `px-3.5` and the same `max-w-[560px]` on both pages. Nothing has to restyle,
 * resize or cross-fade across the seam. The morph is a translation and nothing
 * else, which is what lets it be a genuine move instead of a dissolve pretending
 * to be one.
 *
 * `Course Community - Landing.dc.html`'s `toExplore()` stashes the
 * rect under this same key and `Course Community - Explore.dc.html`'s
 * `pickUpSharedBar()` reads it back, so the key and the shape are the
 * artboards'. What is not the artboards' is how the two ends are driven — see
 * `components/search-morph.tsx`.
 *
 * Nothing here touches React. The write happens in a submit handler and the read
 * happens in a layout effect; neither wants a hook, and keeping the storage
 * rules in one plain module is what makes "consumed exactly once" testable.
 */

/** The artboards' own key, in both `toExplore()` and `pickUpSharedBar()`. */
export const SEARCH_MORPH_KEY = "cc:searchHandoff";

/**
 * How long a stashed rect is still worth animating out of, from the artboard's
 * own `Date.now() - from.t > 4000` guard.
 *
 * The handoff is consumed on the first read, so an ordinary reload of `/search`
 * already finds nothing. This bound covers the case the removal cannot: a submit
 * whose exit animation stalled — a backgrounded tab throttles `requestAnimationFrame`
 * to nothing — and then navigated much later, or a `/search` opened from a
 * bookmark in a tab that had stashed a rect and never arrived. A bar that
 * travels out of where it stood an hour ago is not continuing a gesture; it is
 * inventing one.
 */
export const SEARCH_MORPH_MAX_AGE_MS = 4000;

/** The landing search bar's viewport box, plus when it was measured. */
export type SearchBarHandoff = {
  x: number;
  y: number;
  w: number;
  h: number;
  /** `Date.now()` at the moment of submit. */
  t: number;
};

/**
 * `sessionStorage`, or `null` where there is none to have.
 *
 * The property access itself throws in a Safari private window and wherever
 * site data is blocked outright, so it is inside the `try` rather than beside
 * it. Losing storage costs the animation and nothing else: every caller here
 * falls back to a plain navigation.
 */
function session(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Hand Explore the box this bar is standing in. */
export function stashSearchBarHandoff(
  rect: { left: number; top: number; width: number; height: number },
  now: number = Date.now(),
): void {
  const store = session();
  if (!store) return;
  const handoff: SearchBarHandoff = {
    x: rect.left,
    y: rect.top,
    w: rect.width,
    h: rect.height,
    t: now,
  };
  try {
    store.setItem(SEARCH_MORPH_KEY, JSON.stringify(handoff));
  } catch {
    /* Full or blocked: the navigation still happens, without the morph. */
  }
}

/**
 * Drop any pending handoff.
 *
 * Called on the paths that navigate without animating, so a rect left by an
 * earlier submit can never be picked up by an arrival that did not earn it.
 */
export function clearSearchBarHandoff(): void {
  const store = session();
  if (!store) return;
  try {
    store.removeItem(SEARCH_MORPH_KEY);
  } catch {
    /* Nothing to do: an unreadable store is an unusable handoff either way. */
  }
}

/**
 * Read the pending handoff, and consume it.
 *
 * "Consume" is unconditional: the key is removed before the value is so much as
 * parsed, so a malformed or stale rect is still gone afterwards. A handoff is a
 * single navigation's worth of context, and one that survived its own rejection
 * would be handed to whatever arrived next.
 */
export function takeSearchBarHandoff(
  now: number = Date.now(),
): SearchBarHandoff | null {
  const store = session();
  if (!store) return null;

  let raw: string | null;
  try {
    raw = store.getItem(SEARCH_MORPH_KEY);
    store.removeItem(SEARCH_MORPH_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const handoff = asHandoff(parsed);
  if (!handoff) return null;

  // A negative age means the clock moved between the two pages, which makes the
  // stamp worthless rather than merely fresh — so it is rejected the same way a
  // stale one is.
  const age = now - handoff.t;
  if (age < 0 || age > SEARCH_MORPH_MAX_AGE_MS) return null;

  return handoff;
}

/**
 * `sessionStorage` is writable by anything else running on this origin, so the
 * value is validated rather than trusted: a rect with a `NaN` in it would put
 * the bar somewhere no spring can bring it back from.
 */
function asHandoff(value: unknown): SearchBarHandoff | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  const { x, y, w, h, t } = raw;
  for (const number of [x, y, w, h, t]) {
    if (typeof number !== "number" || !Number.isFinite(number)) return null;
  }
  const handoff = { x, y, w, h, t } as SearchBarHandoff;
  // A zero-sized bar was never on screen; there is nothing to travel out of.
  if (handoff.w <= 0 || handoff.h <= 0) return null;
  return handoff;
}
