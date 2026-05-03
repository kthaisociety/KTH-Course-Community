/**
 * Nest HTTP base path on the **browser origin** (proxied by `next.config.ts` rewrites).
 * All credentialed / session-aware `fetch` from the client should use `nestHttpUrl()`.
 */
const BROWSER_NEST_PREFIX = "/api/nest";

/**
 * Absolute URL to the Nest app for this runtime.
 * - **Browser:** same-origin `/api/nest/...` (rewrites forward to Nest with cookies).
 * - **Server (RSC / Route Handlers / SSR):** `BACKEND_DOMAIN` or `NEXT_PUBLIC_BACKEND_DOMAIN` so requests do not loop through Next.
 *
 * @param path - Must start with `/`, e.g. `/user/me`, `/search?q=1`
 */
export function nestHttpUrl(path: string): string {
  if (!path.startsWith("/")) {
    throw new Error(`nestHttpUrl: path must start with "/", got: ${path}`);
  }
  if (typeof window !== "undefined") {
    return `${BROWSER_NEST_PREFIX}${path}`;
  }
  const base =
    process.env.BACKEND_DOMAIN ?? process.env.NEXT_PUBLIC_BACKEND_DOMAIN;
  if (!base) {
    throw new Error(
      "BACKEND_DOMAIN or NEXT_PUBLIC_BACKEND_DOMAIN must be set for server-side Nest HTTP calls",
    );
  }
  return `${base.replace(/\/$/, "")}${path}`;
}
