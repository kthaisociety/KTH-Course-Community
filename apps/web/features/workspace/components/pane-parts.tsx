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
 * The design draws it as a fixed pale blue (`#9dbfe4`) that no `--cc-*` token
 * carries, so it is derived from the brand fill rather than invented — the
 * same substitution rule the course card's workload bar took in #86.
 *
 * ## Why this `color-mix` stays, when #127 §1 removed the others
 *
 * That rule is "no derivation where a real token exists", and here none does.
 * Re-checked against the 2026-09-05 export: `cc-theme.css` contains no
 * `9dbfe4` and names no token for it, while
 * `Course Community - Workspace Pane.dc.html:115` writes the hex inline for
 * this very segment — and again at `:274`, as the dashed border on the draft's
 * starter pills. So it is a small pale blue the design reuses without ever
 * having named, not a token this file failed to find. Pinning the hex is the
 * one thing that would be wrong: it is a light-mode value, and on the dark page
 * it is a bar that reads as brighter than the brand it is meant to sit under.
 *
 * The derivation is therefore the substitution, not a shortcut past a token.
 * Naming it is worth doing and is not this file's to do — `globals.css` owns
 * both halves of the mirror, and a token would want a dark value chosen for the
 * dark page rather than mixed for it. Filed as a follow-up; until then this
 * constant is the single place the mix is written, and
 * `features/reviews/components/reviewer-card.tsx` carries the one copy that has
 * escaped it.
 */
export const APPLIED_FILL =
  "color-mix(in srgb, var(--cc-btn) 40%, var(--cc-surface))";
