/**
 * Up to two initials for an avatar, from a display name and falling back to the
 * email.
 *
 * Shared so the rail's circle and My Page's avatar can never disagree about the
 * same account. The rail already made that argument about its own two fields —
 * name and initials fall through the same fields in the same order — and a
 * second copy of the rule in another feature is how such a guarantee quietly
 * stops holding.
 */
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
