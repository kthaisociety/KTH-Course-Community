/**
 * Where a sign-in comes back to.
 *
 * Signing in is a round trip through somebody else's site, and Better Auth
 * needs to be told where to land afterwards. `AuthReasonDialog` promises "You
 * keep everything you were looking at", and its `callbackURL` is what keeps
 * that promise. The difference is a student returning to the draft they were
 * writing rather than to an empty search box, and it is the whole of what this
 * file is for.
 *
 * The route carries the destination in `?next=`, because the email path has no
 * other way to carry anything: the dialog navigates to `/auth`, `/auth` sends
 * mail, and the link in that mail is opened in a new tab whose React state,
 * history and per-tab storage are all empty. The URL is the only thing that
 * survives that.
 *
 * ## Only a path, ever
 *
 * A destination taken off the URL is attacker-controlled — `?next=` is exactly
 * as easy to write as it is to read, and a sign-in flow that will forward to
 * anything is the standard shape of an open redirect: the victim clicks a link
 * on the real site, really signs in, and lands somewhere else entirely with
 * their guard down. So `safeReturnTo` takes a same-site *path* or nothing, and
 * every way of spelling "somewhere else" is nothing: an absolute URL, a
 * scheme-relative `//evil.example`, a backslash the browser normalises into
 * one, or anything that does not begin at the site root.
 *
 * Better Auth checks `callbackURL` against its trusted origins too. This is the
 * near side of that, and it is the side that decides whether the fallback is
 * used at all.
 */

/** Where sign-in lands when the URL does not say, and the app's front door. */
export const DEFAULT_RETURN_TO = "/search";

/** The parameter `/auth` reads its destination from. */
export const RETURN_TO_PARAM = "next";

/**
 * A same-site path to return to, or `DEFAULT_RETURN_TO`.
 *
 * Pure, and takes the candidate rather than reading the URL, so the rules above
 * are testable without a browser.
 */
export function safeReturnTo(candidate: string | null | undefined): string {
  if (typeof candidate !== "string") return DEFAULT_RETURN_TO;
  const path = candidate.trim();

  // A path, from the root. Not `//host`, not `/\host` — browsers read the
  // backslash as a slash and both are "leave this site" written to look local.
  if (!path.startsWith("/")) return DEFAULT_RETURN_TO;
  if (path.startsWith("//") || path.startsWith("/\\")) return DEFAULT_RETURN_TO;

  // A control character inside a URL is either an encoding accident or a header
  // trick; neither is a page. Checked by code point rather than by regex, so
  // what is being rejected is named rather than typed.
  for (const character of path) {
    const code = character.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return DEFAULT_RETURN_TO;
  }

  // Coming back to the sign-in page from the sign-in page is a loop with a
  // signed-in user standing in it.
  const route = path.split(/[?#]/, 1)[0];
  if (route === "/auth" || route.startsWith("/auth/")) return DEFAULT_RETURN_TO;

  return path;
}

/** The page the visitor is on, query intact, as a return destination. */
export function currentReturnTo(): string {
  return safeReturnTo(window.location.pathname + window.location.search);
}

/** `/auth`, told where to send the visitor once they are in. */
export function authHref(returnTo: string): string {
  const path = safeReturnTo(returnTo);
  if (path === DEFAULT_RETURN_TO) return "/auth";
  return `/auth?${RETURN_TO_PARAM}=${encodeURIComponent(path)}`;
}

/**
 * What `/auth` was asked to return to, read off its own URL.
 *
 * Read from `window.location` rather than through `useSearchParams`, because
 * both callers need it inside a submit handler and neither needs it during a
 * render — so there is nothing here for a Suspense boundary to wait on, and
 * `/auth` stays as statically renderable as it was.
 */
export function requestedReturnTo(): string {
  try {
    return safeReturnTo(
      new URLSearchParams(window.location.search).get(RETURN_TO_PARAM),
    );
  } catch {
    return DEFAULT_RETURN_TO;
  }
}
