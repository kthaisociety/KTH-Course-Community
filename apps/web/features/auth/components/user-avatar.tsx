"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initialsOf } from "@/lib/identity";
import { cn } from "@/lib/utils";

/**
 * The account's own shape: whatever the sign-in provider handed Better Auth,
 * with the fields this needs and nothing more, so both `Me` and a raw session
 * user satisfy it.
 */
type Identity = {
  name?: string | null;
  email?: string | null;
  /** The provider's picture, or null. See {@link UserAvatar} for who has one. */
  image?: string | null;
};

type Props = {
  /** Null while the session is still resolving, or for a signed-out reader. */
  user: Identity | null;
  /** The circle: its size, and anything else the surface wants of the root. */
  className?: string;
  /** The initials behind the picture — each surface paints its own. */
  fallbackClassName?: string;
};

/**
 * The reader's picture, wherever the app shows who is signed in: the landing
 * header, the rail, and My Page.
 *
 * `users.image` is a Better Auth column filled by the Google or GitHub profile
 * at sign-in. Nothing in this app writes it, so a magic-link account has none
 * and falls back to initials — and because Better Auth is left on its defaults,
 * a second provider linked to an existing account does not overwrite the column
 * either: whichever provider created the row keeps the picture. That is the
 * behaviour this component renders, not one it decides.
 *
 * Radix falls through to the fallback whenever the provider's URL fails to
 * load, so an expired or blocked picture degrades to initials rather than to a
 * broken image. The primitive's hairline is `mix-blend-darken` in light and
 * `mix-blend-lighten` in dark, so it only draws where the picture would
 * otherwise bleed into the surface behind it — invisible on the solid fallback
 * circles, an edge on a photo.
 *
 * `alt=""` on purpose: every one of the three call sites puts the reader's name
 * immediately beside the circle, so announcing the picture would read the same
 * account twice.
 */
export function UserAvatar({ user, className, fallbackClassName }: Props) {
  const image = user?.image ?? null;

  return (
    <Avatar className={cn("flex-none", className)}>
      {image ? <AvatarImage src={image} alt="" /> : null}
      <AvatarFallback className={fallbackClassName}>
        {initialsOf(user?.name ?? "", user?.email ?? "")}
      </AvatarFallback>
    </Avatar>
  );
}
