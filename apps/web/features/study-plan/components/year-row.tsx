"use client";

import {
  Check,
  ChevronDown,
  CircleDot,
  CornerDownRight,
  Plus,
  TriangleAlert,
  X,
} from "lucide-react";
import { type DragEvent, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { PlanItem } from "../lib/build-plan";
import {
  ayLabel,
  type Period,
  type Slot,
  slotIndex,
  slotLabel,
  termLabel,
} from "../lib/slots";
import { CourseBar, DRAG_TYPE } from "./course-bar";
import { StatusPill } from "./status-pill";

type Props = {
  ay: number;
  studyYear: number;
  periods: Period[];
  items: PlanItem[];
  load: Map<number, number>;
  warningsByCode: Map<string, number>;
  selected: string | null;
  now: Slot;
  /** "Master's part" over year 4, and the like. */
  label?: string;
  defaultOpen: boolean;
  onDropCourse: (code: string, slot: Slot) => void;
  onSelect: (code: string) => void;
  onNudge: (item: PlanItem, direction: -1 | 1) => void;
  /** Folding a year that holds the selected course also closes that course's detail. */
  onClearSelection: () => void;
  /** The period the course list is choosing a course for, outlined so it's clear where one will go. */
  addTarget: Slot | null;
  /** Asks the course list for courses given in this period. */
  onAddTo: (slot: Slot) => void;
};

/**
 * A period that is over: faint diagonal lines in the card's own rule colour.
 * It says "done with" without a solid fill, which in the dark theme read as a
 * hole in the card rather than a quieter period.
 */
const PAST_HATCH = {
  backgroundImage:
    "repeating-linear-gradient(135deg, var(--cc-rule) 0 1px, transparent 1px 10px)",
};

const PERIOD_NAME: Record<Period, string> = {
  1: "P1",
  2: "P2",
  3: "P3",
  4: "P4",
  5: "Summer",
};

/** Full-time study: 60 hp a year, 15 a period. */
const YEAR_NORM = 60;
const PERIOD_NORM = 15;

const fmtHp = (n: number) =>
  n.toLocaleString("sv-SE", { maximumFractionDigits: 1 });

/** How full a period is, against 15 hp: brand up to full time, amber over it, red past 22.5. */
function LoadBar({
  credits,
  labelled,
}: {
  credits: number;
  labelled: boolean;
}) {
  return (
    <span className="block px-1.5">
      <span className="block h-[3px] overflow-hidden rounded-full bg-cc-pill">
        <span
          className={cn(
            "block h-full rounded-full",
            credits > 22.55
              ? "bg-cc-danger"
              : credits > 15.05
                ? "bg-cc-score-workload"
                : "bg-cc-brand",
          )}
          style={{
            width: `${Math.min(100, (credits / PERIOD_NORM) * 100)}%`,
          }}
        />
      </span>
      {labelled ? (
        <span
          className={cn(
            "mt-1 block",
            credits > 15.05 ? "text-cc-warn-ink" : "text-cc-muted",
          )}
        >
          {fmtHp(credits)} hp
        </span>
      ) : null}
    </span>
  );
}

/**
 * One study year: periods as columns, courses as bars spanning the periods
 * their round uses. Dropping anywhere on the year places the course in the
 * column under the pointer. A year that is over folds to one line, because a
 * student plans forward and the past only needs to be visible on demand.
 * Too narrow for four columns (a phone), the periods stack as rows instead.
 */
export function YearRow({
  ay,
  studyYear,
  periods,
  items,
  load,
  warningsByCode,
  selected,
  now,
  label,
  defaultOpen,
  onDropCourse,
  onSelect,
  onNudge,
  onClearSelection,
  addTarget,
  onAddTo,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [dropCol, setDropCol] = useState<number | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const nowIdx = slotIndex(now);
  const yearCredits = periods.reduce(
    (a, p) => a + (load.get(slotIndex({ ay, p })) ?? 0),
    0,
  );
  // A year still ahead that is far from full time: worth a second look, not an alarm.
  const offNorm =
    ay >= now.ay && Math.abs(yearCredits - YEAR_NORM) > PERIOD_NORM / 2;
  const done = items.length > 0 && items.every((i) => i.status === "passed");
  const isNow = ay === now.ay;
  const notPassed = items.filter((i) => i.status === "not-passed").length;
  const warnings = items.reduce(
    (a, i) => a + (warningsByCode.get(i.code) ?? 0),
    0,
  );
  const holdsSelected = items.some((i) => i.code === selected);
  // A course selected from elsewhere (the to-do list, a chip) opens its year,
  // but the year can still be folded afterwards: that closes the detail too.
  useEffect(() => {
    if (holdsSelected) setOpen(true);
  }, [holdsSelected]);
  const shown = open;

  const colAt = (x: number) => {
    const r = bodyRef.current?.getBoundingClientRect();
    if (!r) return 0;
    return Math.max(
      0,
      Math.min(
        periods.length - 1,
        Math.floor(((x - r.left) / r.width) * periods.length),
      ),
    );
  };
  const onDragOver = (e: DragEvent) => {
    if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropCol(colAt(e.clientX));
  };
  const onDrop = (e: DragEvent) => {
    const code = e.dataTransfer.getData(DRAG_TYPE);
    setDropCol(null);
    if (!code) return;
    e.preventDefault();
    onDropCourse(code, { ay, p: periods[colAt(e.clientX)] });
  };

  const bars = items.flatMap((it) => {
    const inYear = it.segments.filter(
      (s) => s.slot.ay === ay && periods.includes(s.slot.p),
    );
    if (!inYear.length) return [];
    const first = periods.indexOf(inYear[0].slot.p);
    const last = periods.indexOf(inYear[inYear.length - 1].slot.p);
    return [
      {
        it,
        col: first + 1,
        span: last - first + 1,
        left: slotIndex(it.segments[0].slot) < slotIndex(inYear[0].slot),
        right:
          slotIndex(it.segments[it.segments.length - 1].slot) >
          slotIndex(inYear[inYear.length - 1].slot),
      },
    ];
  });
  const isTarget = (p: Period) => addTarget?.ay === ay && addTarget.p === p;
  // A period still ahead with room left asks to be filled. "Room" is credits under full
  // time, not "no course touches it": a 3 hp course running all year leaves a period empty in practice.
  const hasRoom = (p: Period) => {
    const idx = slotIndex({ ay, p });
    return idx >= nowIdx && (load.get(idx) ?? 0) < PERIOD_NORM - 0.05;
  };
  const addTile = (p: Period, className?: string) => (
    <button
      type="button"
      onClick={() => onAddTo({ ay, p })}
      aria-label={`Add a course to ${slotLabel({ ay, p })}`}
      className={cn(
        "flex min-h-[76px] cursor-pointer items-center justify-center gap-1.5 rounded-[12px] border border-dashed text-[12px] outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-cc-focus/30",
        isTarget(p)
          ? "border-cc-brand/60 bg-cc-checked-tint text-cc-brand"
          : "border-cc-rule2 text-cc-muted hover:border-cc-brand/50 hover:bg-cc-pill hover:text-cc-ink",
        className,
      )}
    >
      <Plus aria-hidden size={14} />
      {isTarget(p) ? "Choosing…" : "Add course"}
    </button>
  );
  const columns = {
    gridTemplateColumns: `repeat(${periods.length}, minmax(0, 1fr))`,
  };

  return (
    <section
      aria-label={`Year ${studyYear}, ${ayLabel(ay)}`}
      className="@container rounded-[16px] border border-cc-rule bg-cc-surface"
    >
      <button
        type="button"
        onClick={() => {
          if (open && holdsSelected) onClearSelection();
          setOpen(!open);
        }}
        aria-expanded={shown}
        className="flex w-full cursor-pointer flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-[16px] px-5 py-3.5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-cc-focus/30"
      >
        <span className="flex min-w-0 items-center gap-3">
          {/* The study year is the title; the calendar year is its caption, not a rival on the same line. */}
          <span className="flex flex-col leading-tight">
            <span className="font-semibold text-[15px] text-cc-ink">
              Year {studyYear}
            </span>
            <span className="text-[11.5px] text-cc-muted tabular-nums">
              {ay}–{String(ay + 1).slice(2)}
            </span>
          </span>
          {label ? (
            // Which part of the degree the year belongs to: a quiet outline pill,
            // so it doesn't compete with the year's status on the right.
            <StatusPill tone="outline" className="hidden @md:inline-flex">
              {label}
            </StatusPill>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {/* At most one state pill: what the student would want to know first about this year. */}
          {notPassed ? (
            <StatusPill tone="danger" icon={X}>
              {notPassed} not passed
            </StatusPill>
          ) : warnings ? (
            <StatusPill tone="warn" icon={TriangleAlert}>
              {warnings} to check
            </StatusPill>
          ) : done ? (
            <StatusPill tone="success" icon={Check}>
              Done
            </StatusPill>
          ) : isNow ? (
            <StatusPill tone="brand" icon={CircleDot}>
              Now
            </StatusPill>
          ) : null}
          {/* Credits against a full-time year, so "24 hp" reads as light rather than as a bare number. */}
          <StatusPill
            tone="neutral"
            title={`A full-time year is ${YEAR_NORM} hp`}
          >
            <span className={cn(offNorm && "text-cc-warn-ink")}>
              {fmtHp(yearCredits)}
            </span>
            <span className="text-cc-muted">/ {YEAR_NORM} hp</span>
          </StatusPill>
          <ChevronDown
            aria-hidden
            size={16}
            className={cn(
              "ml-1 text-cc-muted transition-transform",
              shown && "rotate-180",
            )}
          />
        </span>
        {/* Folded, the year still shows how full each period is. */}
        {!shown ? (
          <span aria-hidden className="grid basis-full gap-2" style={columns}>
            {periods.map((p) => (
              <LoadBar
                key={p}
                credits={load.get(slotIndex({ ay, p })) ?? 0}
                labelled={false}
              />
            ))}
          </span>
        ) : null}
      </button>
      {shown ? (
        <>
          {/* Too narrow for four columns: one period per row, a course under the period it starts in. */}
          <div className="flex flex-col gap-2 px-3 pb-3 @[540px]:hidden">
            {periods.map((p, i) => {
              const slot = { ay, p };
              const idx = slotIndex(slot);
              const col = i + 1;
              const starting = bars.filter((b) => b.col === col);
              const continuing = bars.filter(
                (b) => b.col < col && b.col + b.span - 1 >= col,
              );
              const credits = load.get(idx) ?? 0;
              return (
                <div
                  key={p}
                  style={idx < nowIdx ? PAST_HATCH : undefined}
                  className={cn(
                    "rounded-[12px] p-2",
                    idx === nowIdx && "bg-cc-info",
                  )}
                >
                  <div className="flex items-center justify-between gap-2 px-1 pb-1.5 text-[11.5px] text-cc-muted">
                    <span className="flex items-center gap-1.5">
                      {idx === nowIdx ? (
                        <StatusPill tone="brand" size="sm">
                          {PERIOD_NAME[p]} · now
                        </StatusPill>
                      ) : (
                        <span className="font-medium">{PERIOD_NAME[p]}</span>
                      )}
                      <span>{termLabel(slot)}</span>
                    </span>
                    <span
                      className={cn(
                        "tabular-nums",
                        credits > 15.05 && "text-cc-warn-ink",
                      )}
                    >
                      {fmtHp(credits)} hp
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {starting.map((b) => (
                      <CourseBar
                        key={b.it.code}
                        item={b.it}
                        col={1}
                        span={1}
                        continuesLeft={b.left}
                        continuesRight={b.span > 1 || b.right}
                        warnings={warningsByCode.get(b.it.code) ?? 0}
                        selected={selected === b.it.code}
                        onSelect={() => onSelect(b.it.code)}
                        onNudge={(d) => onNudge(b.it, d)}
                        className="self-stretch"
                      />
                    ))}
                    {continuing.map((b) => (
                      <button
                        key={b.it.code}
                        type="button"
                        onClick={() => onSelect(b.it.code)}
                        className="flex cursor-pointer items-center gap-1.5 rounded-[10px] px-2 py-1 text-left text-[12px] text-cc-muted hover:bg-cc-pill"
                      >
                        <CornerDownRight aria-hidden size={13} />
                        <span className="font-mono text-cc-brand">
                          {b.it.code}
                        </span>
                        continues
                      </button>
                    ))}
                    {hasRoom(p) ? addTile(p, "min-h-[52px]") : null}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="scrollbar-subtle hidden overflow-x-auto px-4 pb-4 @[540px]:block">
            <div className="min-w-[540px]">
              <div
                className="grid gap-2 text-[11.5px] text-cc-muted"
                style={columns}
              >
                {periods.map((p) => {
                  const idx = slotIndex({ ay, p });
                  return (
                    <div
                      key={p}
                      className="flex min-h-[26px] items-center gap-1.5 px-1.5 pb-1.5 font-medium"
                    >
                      {idx === nowIdx ? (
                        <StatusPill tone="brand" size="sm">
                          {PERIOD_NAME[p]} · now
                        </StatusPill>
                      ) : (
                        <span>{PERIOD_NAME[p]}</span>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* biome-ignore lint/a11y/noStaticElementInteractions: a drop target for dragged bars; every move also has the side panel's "Move course". */}
              <div
                ref={bodyRef}
                onDragOver={onDragOver}
                onDragLeave={() => setDropCol(null)}
                onDrop={onDrop}
                className="relative min-h-[76px]"
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 grid gap-2"
                  style={columns}
                >
                  {periods.map((p, i) => {
                    const idx = slotIndex({ ay, p });
                    return (
                      <div
                        key={p}
                        style={idx < nowIdx ? PAST_HATCH : undefined}
                        className={cn(
                          "rounded-[12px]",
                          idx === nowIdx && "bg-cc-info",
                          (dropCol === i || isTarget(p)) &&
                            "outline-2 outline-cc-brand/50 outline-dashed",
                        )}
                      />
                    );
                  })}
                </div>
                <div
                  className="relative grid grid-flow-row-dense gap-2 p-0"
                  style={columns}
                >
                  {bars.map((b) => (
                    <CourseBar
                      key={`${b.it.code}-${b.col}`}
                      item={b.it}
                      col={b.col}
                      span={b.span}
                      continuesLeft={b.left}
                      continuesRight={b.right}
                      warnings={warningsByCode.get(b.it.code) ?? 0}
                      selected={selected === b.it.code}
                      onSelect={() => onSelect(b.it.code)}
                      onNudge={(d) => onNudge(b.it, d)}
                    />
                  ))}
                  {periods.map((p, i) =>
                    hasRoom(p) ? (
                      <div
                        key={`add-${p}`}
                        style={{ gridColumn: `${i + 1} / span 1` }}
                        className="flex"
                      >
                        {addTile(p, "flex-1")}
                      </div>
                    ) : null,
                  )}
                  {bars.length === 0 &&
                  periods.every((p) => slotIndex({ ay, p }) < nowIdx) ? (
                    <p className="col-span-full px-2 py-6 text-center text-[12.5px] text-cc-muted">
                      Nothing in this year. Drag a course here to place it.
                    </p>
                  ) : null}
                </div>
              </div>
              <div
                className="mt-2 grid gap-2 text-[11.5px] tabular-nums"
                style={columns}
              >
                {periods.map((p) => (
                  <LoadBar
                    key={p}
                    credits={load.get(slotIndex({ ay, p })) ?? 0}
                    labelled
                  />
                ))}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
