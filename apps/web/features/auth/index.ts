export { useMeQuery } from "./api/queries";
export {
  type AuthReason,
  AuthReasonDialog,
} from "./components/auth-reason-dialog";
export { useRequireSession, useSessionData } from "./hooks/session";
export { useLogout } from "./hooks/use-logout";
export { useMe } from "./hooks/use-me";
/**
 * Where a sign-in comes back to.
 *
 * On the barrel because a feature that sends somebody to `/auth` is exactly who
 * needs it, and `/auth` reads `?next=` off its own URL. Without it here the
 * only reachable way to link to the sign-in page was a bare `/auth`, which
 * lands the reader on `/search` afterwards however far they had got — which is
 * what My Page's signed-out panel did.
 */
export { authHref, currentReturnTo, safeReturnTo } from "./lib/return-to";
