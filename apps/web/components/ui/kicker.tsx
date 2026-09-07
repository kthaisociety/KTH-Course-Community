import type { ReactNode } from "react";

/**
 * The small uppercase label above a section.
 *
 * The artboards give one label treatment to every card that has a section
 * heading — a course being read, a review being written, a review being read
 * back on My Page — and keeping a copy of it in each is how the three drift.
 *
 * It is here rather than in a feature because three features draw it now. Not a
 * shadcn primitive, unlike most of this folder; it is one of ours, and it lives
 * beside them because a shared component with no feature to belong to has
 * nowhere else to go.
 */
export function Kicker({ children }: { children: ReactNode }) {
  return (
    <div className="font-semibold text-[10.5px] text-cc-dim uppercase tracking-[0.09em]">
      {children}
    </div>
  );
}
