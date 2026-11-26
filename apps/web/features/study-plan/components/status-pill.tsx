import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The plan's status label: a fully rounded, tinted pill with an optional icon.
 *
 * It follows the app's own pill vocabulary (`rounded-full`, 12px semibold,
 * tabular figures), seen on My Page's and Reviews' count and warning pills,
 * and adds a tone per state. Colour is never the only signal: every pill
 * carries a word, and most an icon too.
 */
export type PillTone =
  | "success"
  | "warn"
  | "danger"
  | "brand"
  | "neutral"
  | "outline";

const TONE: Record<PillTone, string> = {
  success: "bg-cc-success-tint text-cc-success-ink",
  warn: "bg-cc-warn text-cc-warn-ink ring-1 ring-cc-warn-border ring-inset",
  danger: "bg-cc-danger-tint text-cc-danger-ink",
  brand: "bg-cc-checked-tint text-cc-brand",
  neutral: "bg-cc-pill text-cc-chip-ink",
  // A secondary fact next to a filled pill, e.g. "Elective" beside "Mandatory".
  outline: "text-cc-muted ring-1 ring-cc-rule2 ring-inset",
};

type Props = {
  tone: PillTone;
  icon?: LucideIcon;
  children: ReactNode;
  /** `sm` sits inside a course bar; `md` heads a card or a row. */
  size?: "sm" | "md";
  title?: string;
  className?: string;
};

export function StatusPill({
  tone,
  icon: Icon,
  children,
  size = "md",
  title,
  className,
}: Props) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full font-semibold tabular-nums leading-none",
        size === "md"
          ? "gap-1.5 px-2.5 py-[5px] text-[12px]"
          : "gap-1 px-2 py-[3px] text-[11px]",
        TONE[tone],
        className,
      )}
    >
      {Icon ? (
        <Icon
          aria-hidden
          size={size === "md" ? 13 : 11}
          strokeWidth={2.6}
          className="shrink-0"
        />
      ) : null}
      {children}
    </span>
  );
}
