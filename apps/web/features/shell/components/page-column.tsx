import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The content column every page renders inside, beneath the shell's topbar.
 *
 * `docs/design/cc-store.js` keeps the cap as one shared constant rather than a
 * literal per artboard —
 *
 *   "Shared page-content cap. Every top-level page shell reads this instead of
 *    hardcoding its own 1216px literal, so the width stays one source of truth
 *    across Explore/Saved/My Page."
 *
 * so it is one component here for the same reason. `PAGE_MAX_WIDTH` is 1216px
 * and `PAGE_SIDE_PADDING` is 20px.
 *
 * Below `@2xl` the column gives that side padding up. Every page inside it
 * already carries `PageHeader`'s own 28px, and 48px a side on a phone leaves
 * nothing for the text. The breakpoint is a container query on the column
 * itself, not the viewport, matching how the artboards respond.
 */
export function PageColumn({
  children,
  className,
  contentClassName,
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <div className={cn("@container", className)}>
      <div
        className={cn(
          "mx-auto flex w-full max-w-[1216px] flex-col pb-15 @2xl:px-5",
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
