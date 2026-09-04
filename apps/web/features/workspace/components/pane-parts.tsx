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
 */
export const APPLIED_FILL =
  "color-mix(in srgb, var(--cc-btn) 40%, var(--cc-surface))";
