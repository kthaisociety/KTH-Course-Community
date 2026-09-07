/**
 * How an account presents itself when the app has only a session to go on: a
 * display name, and the initials the avatar falls back to when there is no
 * picture.
 *
 * Both fall through the same fields in the same order, so a circle can never
 * disagree with the name beside it. Shared because three surfaces draw that
 * pair — the landing header, the rail and My Page — and a second copy of the
 * rule in another feature is how such a guarantee quietly stops holding. The
 * rail and My Page had already made that argument about the initials; the
 * landing header kept a private copy of both until they moved here.
 *
 * Not to be confused with My Page's own heading, which is deliberately
 * different: it shows the whole email rather than its local part, and carries a
 * third fallback for the frame before the session resolves.
 */

/** The name to show for an account, falling back to the email's local part. */
export function displayNameOf(name: string, email: string): string {
  return name.trim() || email.trim().split("@")[0] || "";
}

/** Up to two initials, from a display name and falling back to the email. */
export function initialsOf(name: string, email: string): string {
  const fromName = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return fromName || email.trim().charAt(0).toUpperCase() || "?";
}
