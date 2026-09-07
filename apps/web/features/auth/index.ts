export { useMeQuery } from "./api/queries";
export {
  type AuthReason,
  AuthReasonDialog,
} from "./components/auth-reason-dialog";
export {
  SignInPrompt,
  type SignInPromptAction,
} from "./components/sign-in-prompt";
/**
 * On the barrel because every surface that shows who is signed in draws it —
 * the landing header, the rail and My Page — and they must not each decide for
 * themselves whether the provider's picture counts.
 */
export { UserAvatar } from "./components/user-avatar";
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
