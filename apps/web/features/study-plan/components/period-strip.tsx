import { cn } from "@/lib/utils";
import type { Period } from "../lib/slots";

/**
 * When a course runs, at a glance: P1–P4 as four small cells, the ones its
 * rounds start in filled. A course with no known round shows no strip, rather
 * than four empty cells that would read as "never".
 */
export function PeriodStrip({
  starts,
  className,
}: {
  starts: readonly Period[];
  className?: string;
}) {
  if (!starts.length) return null;
  const given = starts.map((p) => (p === 5 ? "summer" : `P${p}`)).join(", ");
  return (
    <span
      title={`Given in ${given}`}
      className={cn("flex items-center gap-0.5", className)}
    >
      <span className="sr-only">Given in {given}</span>
      {([1, 2, 3, 4] as const).map((p) => {
        const on = starts.includes(p);
        return (
          <span
            key={p}
            aria-hidden
            className={cn(
              "flex h-[19px] w-[22px] items-center justify-center font-semibold text-[10px] tabular-nums",
              p === 1 && "rounded-l-full",
              p === 4 && "rounded-r-full",
              on
                ? "bg-cc-success-tint text-cc-success-ink"
                : "bg-cc-pill text-cc-dim",
            )}
          >
            P{p}
          </span>
        );
      })}
    </span>
  );
}
