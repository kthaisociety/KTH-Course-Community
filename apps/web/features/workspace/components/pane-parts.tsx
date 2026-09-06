import type { ReactNode } from "react";

/**
 * The two bits of chrome both halves of the pane draw the same way.
 *
 * A course being read and a review being written are different surfaces, but
 * the artboard gives them one section label and one fill for the applied end
 * of a theory/applied bar. Keeping either in both files is how the two drift.
 */

/** The small uppercase label above a section, in both panels. */
export function Kicker({ children }: { children: ReactNode }) {
  return (
    <div className="font-semibold text-[10.5px] text-cc-dim uppercase tracking-[0.09em]">
      {children}
    </div>
  );
}

/**
 * The applied end of a theory/applied bar.
 *
 * This was a `color-mix` of `--cc-btn` over `--cc-surface` — the substitution
 * #86 settled for a design colour with no token, kept when #127 §1 removed the
 * other two derivations because those had a real token to swap to and this one
 * did not. #173 named it: `--cc-applied` in `globals.css` carries a value per
 * theme, the light one being the artboard's own literal and the dark one chosen
 * for the dark page rather than mixed for it. The reasoning lives with the
 * token, which is where a colour's reasoning belongs.
 *
 * The constant stays, because what it is for has not changed. A course being
 * read and a review being written draw the same bar in two files, and the token
 * alone would not stop one of them reaching for `--cc-hov` next time. It is now
 * a name for the token rather than a name for a mix, so the copy in
 * `features/reviews/components/reviewer-card.tsx` — which drew the same bar and
 * had drifted out of here already — is harmless where it is not identical:
 * both spell the one token.
 */
export const APPLIED_FILL = "var(--cc-applied)";
