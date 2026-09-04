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
 * cookie passes here and is rejected by tRPC `protectedProcedure`, which is the
 * real enforcement. Do not mistake this for authorisation.
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/auth", request.url));
  }
  return NextResponse.next();
}

/**
 * Every route that needs an account. A route renamed without its entry here
 * silently loses its signed-out redirect, which is why `/saved` moved in the
 * same commit that moved the page (#90).
 */
export const config = {
  matcher: ["/profile/:path*", "/saved/:path*", "/taken/:path*"],
};
