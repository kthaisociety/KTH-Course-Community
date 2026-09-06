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
 *
 * `/profile` and `/saved` are deliberately **not** here. The artboards draw
 * both of them for a signed-out reader — `/saved` as a working page whose saves
 * live in the browser
 * (`docs/design_ref/2026-09-06/Course Community - Saved.dc.html:322`), and
 * `/profile` as the in-place "Sign in to see your page" panel
 * (`… - My Page.dc.html:73`) inside the shell, with the rail carrying its guest
 * banner. A redirect to `/auth` renders neither, and both pages already carry
 * the signed-out branch this matcher was hiding.
 *
 * `/taken` stays gated while the transcript route is account-only. The artboard
 * gives it a guest state too — upload and parse, then gate at "Sign in to keep
 * this list" (`… - Taken Courses.dc.html:1305`) — and honouring that means
 * opening an unauthenticated PDF parse, which is its own decision.
 */
export const config = {
  matcher: ["/taken/:path*"],
};
