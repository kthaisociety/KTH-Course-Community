"use client";

import { ChevronDown } from "lucide-react";
import { type DragEvent, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { PlanItem } from "../lib/build-plan";
import { ayLabel, type Period, type Slot, slotIndex } from "../lib/slots";
import { CourseBar, DRAG_TYPE } from "./course-bar";

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
};

const PERIOD_NAME: Record<Period, string> = {
  1: "P1",
  2: "P2",
  3: "P3",
  4: "P4",
  5: "Summer",
};

/**
 * One study year: periods as columns, courses as bars spanning the periods
 * their round uses. Dropping anywhere on the year places the course in the
 * column under the pointer. A year that is over folds to one line, because a
 * student plans forward and the past only needs to be visible on demand.
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
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [dropCol, setDropCol] = useState<number | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const nowIdx = slotIndex(now);
  const yearCredits = periods.reduce(
    (a, p) => a + (load.get(slotIndex({ ay, p })) ?? 0),
    0,
  );
  const done = items.length > 0 && items.every((i) => i.status === "passed");
  const shown = open || items.some((i) => i.code === selected);

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

  return (
    <section
      aria-label={`Year ${studyYear}, ${ayLabel(ay)}`}
      className="rounded-[16px] border border-cc-rule bg-cc-surface"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={shown}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-5 py-3.5 text-left"
      >
        <span className="flex min-w-0 items-baseline gap-2.5">
          <span className="font-semibold text-[15px] text-cc-ink">
            Year {studyYear}
          </span>
          <span className="text-[12.5px] text-cc-muted">{ayLabel(ay)}</span>
          {label ? (
            <span className="rounded-full bg-cc-pill px-2 py-0.5 text-[11.5px] text-cc-chip-ink">
              {label}
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center gap-3 text-[12.5px] text-cc-muted tabular-nums">
          {done ? <span className="text-cc-success-ink">Done</span> : null}
          <span>
            {yearCredits.toLocaleString("sv-SE", { maximumFractionDigits: 1 })}{" "}
            hp
          </span>
          <ChevronDown
            aria-hidden
            size={16}
            className={cn("transition-transform", shown && "rotate-180")}
          />
        </span>
      </button>
      {shown ? (
        // On a phone the periods keep a readable width and the year scrolls sideways, never the page.
        <div className="scrollbar-subtle overflow-x-auto px-4 pb-4">
          <div className="min-w-[540px]">
            <div
              className="grid gap-2 text-[11.5px] text-cc-muted"
              style={{
                gridTemplateColumns: `repeat(${periods.length}, minmax(0, 1fr))`,
              }}
            >
              {periods.map((p) => {
                const idx = slotIndex({ ay, p });
                return (
                  <div
                    key={p}
                    className={cn(
                      "flex items-center justify-between px-1.5 pb-1.5",
                      idx === nowIdx && "font-semibold text-cc-brand",
                    )}
                  >
                    <span>
                      {PERIOD_NAME[p]}
                      {idx === nowIdx ? " · now" : ""}
                    </span>
                  </div>
                );
              })}
            </div>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: a drop target for dragged bars; every move also has the side panel's "Move to". */}
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
                style={{
                  gridTemplateColumns: `repeat(${periods.length}, minmax(0, 1fr))`,
                }}
              >
                {periods.map((p, i) => {
                  const idx = slotIndex({ ay, p });
                  return (
                    <div
                      key={p}
                      className={cn(
                        "rounded-[12px]",
                        idx < nowIdx && "bg-cc-inset",
                        idx === nowIdx && "bg-cc-info",
                        dropCol === i &&
                          "outline-2 outline-cc-brand/50 outline-dashed",
                      )}
                    />
                  );
                })}
              </div>
              <div
                className="relative grid grid-flow-row-dense gap-2 p-0"
                style={{
                  gridTemplateColumns: `repeat(${periods.length}, minmax(0, 1fr))`,
                }}
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
                {bars.length === 0 ? (
                  <p className="col-span-full px-2 py-6 text-center text-[12.5px] text-cc-muted">
                    Drag a course here, or use “Add to” in the course list.
                  </p>
                ) : null}
              </div>
            </div>
            <div
              className="mt-2 grid gap-2 text-[11.5px] tabular-nums"
              style={{
                gridTemplateColumns: `repeat(${periods.length}, minmax(0, 1fr))`,
              }}
            >
              {periods.map((p) => {
                const credits = load.get(slotIndex({ ay, p })) ?? 0;
                return (
                  <div key={p} className="px-1.5">
                    <div className="h-[3px] overflow-hidden rounded-full bg-cc-pill">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          credits > 22.55
                            ? "bg-cc-danger"
                            : credits > 15.05
                              ? "bg-cc-score-workload"
                              : "bg-cc-brand",
                        )}
                        style={{
                          width: `${Math.min(100, (credits / 15) * 100)}%`,
                        }}
                      />
                    </div>
                    <div
                      className={cn(
                        "mt-1",
                        credits > 15.05 ? "text-cc-warn-ink" : "text-cc-muted",
                      )}
                    >
                      {credits.toLocaleString("sv-SE", {
                        maximumFractionDigits: 1,
                      })}{" "}
                      hp
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
