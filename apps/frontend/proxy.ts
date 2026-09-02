import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Redirects signed-out visitors away from the pages that require an account.
 *
 * Next 16 renamed the `middleware` file convention to `proxy`; the exported
 * function must be named `proxy` to match.
 *
 * This is Better Auth's documented *optimistic* check (D12): it tests for the
 * presence of the session cookie and never validates it. A stale or forged
 * cookie passes here and is rejected by the Nest `AuthGuard`, which is the real
 * enforcement. Do not mistake this for authorisation.
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/auth", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Explicit paths only. The proxy runs *before* rewrites, so a broader pattern
  // that caught `/api/*` would intercept `/api/auth/*` and break the proxy to
  // Nest. The rest of the `(service)` group is intentionally public: /search,
  // /course and /reviews are `@AllowAnonymous` on the backend.
  matcher: ["/profile/:path*", "/favorites/:path*"],
};
