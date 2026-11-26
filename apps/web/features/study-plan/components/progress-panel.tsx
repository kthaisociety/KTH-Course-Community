"use client";

import {
  Check,
  ChevronDown,
  CircleDashed,
  Info,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type {
  Criterion,
  CriterionState,
  Meter,
  ProgressSection,
} from "../lib/progress";
import { StatusPill } from "./status-pill";

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

const fmt = (n: number) =>
  (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, "");

function Chips({
  codes,
  onShow,
}: {
  codes: string[];
  onShow: (code: string) => void;
}) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {codes.slice(0, 8).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => onShow(code)}
          className="cursor-pointer rounded-full bg-cc-pill px-2 py-0.5 font-mono text-[11px] text-cc-chip-ink hover:bg-cc-checked-hover-tint"
        >
          {code}
        </button>
      ))}
      {codes.length > 8 ? (
        <span className="px-1 py-0.5 text-[11px] text-cc-muted">
          +{codes.length - 8}
        </span>
      ) : null}
    </div>
  );
}

/**
 * A count toward a target, the way the eye reads it: what, how far, and a bar.
 * Passed fills in full colour and planned in a lighter shade of the same, so a
 * plan that gets there on paper still looks unfinished until it is passed.
 */
/** Planned credits: the passed colour in stripes, so it reads as "not there yet" in both themes. */
const PLANNED_STRIPES = {
  backgroundImage:
    "repeating-linear-gradient(135deg, color-mix(in oklab, var(--cc-success) 75%, transparent) 0 3px, color-mix(in oklab, var(--cc-success) 22%, transparent) 3px 6px)",
};

function MeterRow({
  c,
  m,
  onShow,
}: {
  c: Criterion;
  m: Meter;
  onShow: (code: string) => void;
}) {
  const total = m.done + m.planned;
  const pct = (n: number) =>
    `${Math.min(100, (n / Math.max(m.need, 1)) * 100)}%`;
  const value =
    m.unit === "hp"
      ? `${fmt(total)} / ${fmt(m.need)} hp`
      : `${total} / ${m.need}`;
  const breakdown = `${fmt(m.done)} passed${m.planned ? ` · ${fmt(m.planned)} planned` : ""}${c.state === "short" ? ` · ${fmt(m.need - total)} short` : ""}`;
  return (
    // `relative` keeps the visually hidden meter inside this row: positioned
    // against the page instead, it stretched the document and let the whole
    // app scroll out of view.
    <li className="relative" title={breakdown}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-[13px] text-cc-ink">
          {c.text}
        </span>
        <span
          className={cn(
            "shrink-0 font-semibold text-[12.5px] tabular-nums",
            c.state === "short" ? "text-cc-warn-ink" : "text-cc-ink",
          )}
        >
          {value}
        </span>
      </div>
      {c.detail ? (
        <p className="truncate text-[11.5px] text-cc-muted">{c.detail}</p>
      ) : null}
      <meter
        className="sr-only"
        min={0}
        max={m.need}
        value={Math.min(total, m.need)}
        aria-label={`${c.text}: ${value}, ${breakdown}`}
      />
      <div
        aria-hidden
        className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-cc-pill"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: pct(total), ...PLANNED_STRIPES }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-cc-success"
          style={{ width: pct(m.done) }}
        />
      </div>
      {c.codes?.length && c.state === "short" ? (
        <Chips codes={c.codes} onShow={onShow} />
      ) : null}
    </li>
  );
}

/** The key to the bars, inside the first card that has them rather than floating between cards. */
function Legend() {
  return (
    <div
      aria-hidden
      className="mt-2 flex items-center gap-3 text-[11.5px] text-cc-muted"
    >
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 w-3 rounded-full bg-cc-success" /> Passed
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 w-3 rounded-full" style={PLANNED_STRIPES} />{" "}
        Planned
      </span>
    </div>
  );
}

/** A requirement already met, or met by the plan: nothing to do, so it can fold away. */
const isQuiet = (c: Criterion) =>
  !c.meter && (c.state === "met" || c.state === "planned");

/** Below this many, folding the quiet rows saves less than it hides. */
const FOLD_FROM = 3;

function Row({ c, onShow }: { c: Criterion; onShow: (code: string) => void }) {
  if (c.meter) return <MeterRow c={c} m={c.meter} onShow={onShow} />;
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
          <p className="mt-0.5 text-[12px] text-cc-muted leading-snug">
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
          <Chips codes={c.codes} onShow={onShow} />
        ) : null}
      </div>
    </li>
  );
}

/**
 * The plan's progress, one card per question: the bachelor part, getting into
 * the master's, the master's part, and the degree as a whole. A count is a bar;
 * anything else is a line that is met, met by the plan, short, or not something
 * the data can check.
 */
export function ProgressPanel({
  sections,
  onShow,
}: {
  sections: ProgressSection[];
  onShow: (code: string) => void;
}) {
  const [unfolded, setUnfolded] = useState<ReadonlySet<string>>(new Set());
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
        const allMet = !short && s.criteria.every((c) => c.state === "met");
        // Long checklists (a master's entry requirements) fold what is already
        // on track, so the card leads with what still needs doing.
        const quiet = s.criteria.filter(isQuiet);
        const fold = quiet.length >= FOLD_FROM;
        const open = unfolded.has(s.id);
        const rows =
          fold && !open ? s.criteria.filter((c) => !isQuiet(c)) : s.criteria;
        const quietWord = quiet.every((c) => c.state === "met")
          ? "met"
          : "on track";
        const legendHere =
          s.id === sections.find((x) => x.criteria.some((c) => c.meter))?.id;
        return (
          <section
            key={s.id}
            aria-labelledby={`sp-${s.id}`}
            className="rounded-[16px] border border-cc-rule bg-cc-surface px-5 py-4"
          >
            <div className="flex items-start justify-between gap-3">
              <h3
                id={`sp-${s.id}`}
                className="font-semibold text-[14px] text-cc-ink leading-snug"
              >
                {s.title}
              </h3>
              {/* "Not met", not "to sort out": that phrase belongs to the plan's own list of problems above. */}
              {short ? (
                <StatusPill tone="warn" icon={TriangleAlert}>
                  {short} not met
                </StatusPill>
              ) : allMet ? (
                <StatusPill tone="success" icon={Check}>
                  Done
                </StatusPill>
              ) : (
                <StatusPill tone="success" icon={Check}>
                  On track
                </StatusPill>
              )}
            </div>
            <p className="mt-0.5 text-[12px] text-cc-muted">{s.subtitle}</p>
            {legendHere ? <Legend /> : null}
            <ul className="mt-4 flex flex-col gap-3.5">
              {rows.map((c) => (
                <Row
                  key={`${s.id}-${s.criteria.indexOf(c)}`}
                  c={c}
                  onShow={onShow}
                />
              ))}
              {fold ? (
                <li>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() =>
                      setUnfolded((prev) => {
                        const next = new Set(prev);
                        if (open) next.delete(s.id);
                        else next.add(s.id);
                        return next;
                      })
                    }
                    className="-mx-1.5 flex w-[calc(100%+12px)] cursor-pointer items-center gap-2.5 rounded-[10px] px-1.5 py-1 text-left text-[13px] text-cc-muted hover:bg-cc-pill hover:text-cc-ink"
                  >
                    <Check
                      aria-hidden
                      size={15}
                      strokeWidth={3}
                      className="shrink-0 text-cc-success-ink"
                    />
                    <span className="flex-1">
                      {open ? "Hide the " : ""}
                      {quiet.length} {quietWord}
                    </span>
                    <ChevronDown
                      aria-hidden
                      size={15}
                      className={cn(
                        "shrink-0 transition-transform",
                        open && "rotate-180",
                      )}
                    />
                  </button>
                </li>
              ) : null}
            </ul>
            {s.footnote ? (
              <p className="mt-4 border-cc-rule border-t pt-3 text-[11.5px] text-cc-muted leading-snug">
                {s.footnote}
              </p>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
