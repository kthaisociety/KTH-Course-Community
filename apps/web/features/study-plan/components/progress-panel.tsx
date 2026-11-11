"use client";

import { Check, CircleDashed, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  Criterion,
  CriterionState,
  ProgressSection,
} from "../lib/progress";

const ICON: Record<
  CriterionState,
  { Icon: typeof Check; cls: string; label: string }
> = {
  met: { Icon: Check, cls: "text-cc-success-ink", label: "Met" },
  planned: {
    Icon: CircleDashed,
    cls: "text-cc-brand",
    label: "Met by your plan, not passed yet",
  },
  short: { Icon: TriangleAlert, cls: "text-cc-warn-ink", label: "Not met" },
  unknown: { Icon: Info, cls: "text-cc-dim", label: "Not checked" },
};

function Row({ c, onShow }: { c: Criterion; onShow: (code: string) => void }) {
  const { Icon, cls, label } = ICON[c.state];
  return (
    <li className="flex gap-2.5">
      <Icon
        aria-label={label}
        size={15}
        strokeWidth={c.state === "met" ? 3 : 2}
        className={cn("mt-[2px] shrink-0", cls)}
      />
      <div className="min-w-0">
        <p className="text-[13px] text-cc-ink leading-snug">{c.text}</p>
        {c.detail ? (
          <p className="mt-0.5 whitespace-pre-line text-[12px] text-cc-muted leading-snug">
            {c.detail}
          </p>
        ) : null}
        {c.href ? (
          <a
            href={c.href}
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 inline-block text-[12px] text-cc-brand underline-offset-2 hover:underline"
          >
            KTH's wording (Swedish)
          </a>
        ) : null}
        {c.codes?.length && c.state === "short" ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {c.codes.slice(0, 6).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => onShow(code)}
                className="cursor-pointer rounded-full bg-cc-pill px-2 py-0.5 font-mono text-[11px] text-cc-chip-ink hover:bg-cc-hov/40"
              >
                {code}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </li>
  );
}

/**
 * The plan's progress, one card per question: the bachelor part, getting into
 * the master's, the master's part, and the degree as a whole. Each line is
 * met, met by the plan, short, or not something the data can check.
 */
export function ProgressPanel({
  sections,
  onShow,
}: {
  sections: ProgressSection[];
  onShow: (code: string) => void;
}) {
  if (!sections.length)
    return (
      <p className="text-[13px] text-cc-muted">
        Set up your plan to see your progress.
      </p>
    );
  return (
    <div className="flex flex-col gap-4">
      {sections.map((s) => {
        const short = s.criteria.filter((c) => c.state === "short").length;
        return (
          <section
            key={s.id}
            aria-labelledby={`sp-${s.id}`}
            className="rounded-[14px] border border-cc-rule bg-cc-surface px-5 py-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3
                id={`sp-${s.id}`}
                className="font-semibold text-[14px] text-cc-ink"
              >
                {s.title}
              </h3>
              <span
                className={cn(
                  "shrink-0 text-[12px]",
                  short ? "text-cc-warn-ink" : "text-cc-success-ink",
                )}
              >
                {short ? `${short} to sort out` : "On track"}
              </span>
            </div>
            <p className="mt-0.5 text-[12px] text-cc-muted">{s.subtitle}</p>
            <ul className="mt-3 flex flex-col gap-2.5">
              {s.criteria.map((c, i) => (
                <Row key={`${s.id}-${i}`} c={c} onShow={onShow} />
              ))}
            </ul>
            {s.footnote ? (
              <p className="mt-3 text-[11.5px] text-cc-muted leading-snug">
                {s.footnote}
              </p>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
