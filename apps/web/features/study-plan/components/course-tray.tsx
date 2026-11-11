"use client";

import { Search } from "lucide-react";
import { type DragEvent, useState } from "react";
import { cn } from "@/lib/utils";
import type { PlanCategory } from "@/types/programme";
import { useCourseSearch } from "../api/queries";
import type { PlanItem, TemplateCourse } from "../lib/build-plan";
import type { Slot } from "../lib/slots";
import { DRAG_TYPE } from "./course-bar";
import { fieldClass } from "./plan-setup";

export interface SlotOption {
  value: string;
  label: string;
  slot: Slot;
}

const CATEGORY: Record<PlanCategory, string> = {
  O: "Mandatory",
  VV: "Conditionally elective",
  R: "Recommended",
  V: "Elective",
  "?": "Listed",
};

type Row = {
  code: string;
  title: string;
  credits: number | null;
  note?: string;
};

function TrayRow({
  row,
  options,
  onAdd,
  extra,
}: {
  row: Row;
  options: SlotOption[];
  onAdd: (code: string, slot: Slot) => void;
  extra?: React.ReactNode;
}) {
  const onDragStart = (e: DragEvent) => {
    e.dataTransfer.setData(DRAG_TYPE, row.code);
    e.dataTransfer.setData("text/plain", row.code);
    e.dataTransfer.effectAllowed = "copyMove";
  };
  return (
    <li
      draggable
      onDragStart={onDragStart}
      className="flex cursor-grab items-center gap-3 rounded-[10px] border border-cc-rule bg-cc-surface px-3 py-2 active:cursor-grabbing"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[11.5px] text-cc-brand">
            {row.code}
          </span>
          {row.credits ? (
            <span className="text-[11.5px] text-cc-muted">
              {row.credits.toLocaleString("sv-SE")} hp
            </span>
          ) : null}
        </div>
        <div className="truncate text-[12.5px] text-cc-ink" title={row.title}>
          {row.title}
        </div>
        {row.note ? (
          <div className="text-[11.5px] text-cc-muted">{row.note}</div>
        ) : null}
      </div>
      {extra}
      <select
        aria-label={`Add ${row.code} to a period`}
        value=""
        onChange={(e) => {
          const o = options.find((x) => x.value === e.target.value);
          if (o) onAdd(row.code, o.slot);
        }}
        className="h-8 w-[88px] shrink-0 cursor-pointer rounded-[8px] border border-cc-rule2 bg-cc-surface px-1.5 text-[12px] text-cc-ink"
      >
        <option value="">Add to…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </li>
  );
}

/** The syllabus's remarks are Swedish; only "Endast en av …" carries a rule, so only that one is kept. */
function noteInEnglish(note: string): string {
  const codes = note.match(/\b[A-Z]{2}\d{3}[0-9A-Z]\b/g);
  return /endast en av|bara en av/i.test(note) && codes
    ? `Only one of ${codes.join(", ")} counts`
    : "";
}

type Tab = "place" | "programme" | "saved" | "search" | "out";

type Props = {
  unplaced: PlanItem[];
  electives: TemplateCourse[];
  saved: Row[];
  leftOut: PlanItem[];
  options: SlotOption[];
  onAdd: (code: string, slot: Slot) => void;
  onInclude: (code: string) => void;
  inPlan: Set<string>;
  /** A course's English title, falling back to the syllabus's Swedish one. */
  titleOf: (code: string, fallback: string) => string;
};

/**
 * Where courses come from: taken courses still to place, the syllabus's
 * electives, saved courses, a search, and what was left out. Every row drags
 * onto the grid and has an "Add to…" menu, so nothing needs a pointer.
 */
export function CourseTray({
  unplaced,
  electives,
  saved,
  leftOut,
  options,
  onAdd,
  onInclude,
  inPlan,
  titleOf,
}: Props) {
  const [tab, setTab] = useState<Tab>(unplaced.length ? "place" : "programme");
  const [q, setQ] = useState("");
  const search = useCourseSearch(q);
  const tabs: [Tab, string][] = [
    ["place", "To place"],
    ["programme", "Programme"],
    ["saved", "Saved"],
    ["search", "Search"],
    ["out", "Left out"],
  ];
  const byYear = new Map<number, TemplateCourse[]>();
  for (const e of electives)
    byYear.set(e.studyYear, [...(byYear.get(e.studyYear) ?? []), e]);

  return (
    <section
      aria-label="Courses to add"
      className="rounded-[14px] border border-cc-rule bg-cc-surface"
    >
      <div
        role="tablist"
        aria-label="Course lists"
        className="scrollbar-hidden flex gap-0.5 overflow-x-auto overflow-y-hidden border-cc-rule border-b px-2"
      >
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "-mb-px cursor-pointer whitespace-nowrap border-b-2 px-2.5 py-2.5 text-[12.5px]",
              tab === id
                ? "border-cc-brand font-medium text-cc-ink"
                : "border-transparent text-cc-muted hover:text-cc-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="p-3">
        {tab === "place" ? (
          unplaced.length ? (
            <>
              <p className="mb-2.5 text-[12px] text-cc-muted leading-snug">
                Your transcript says you passed these, but not when. Drag each
                into the period you took it, so it counts toward the right year.
              </p>
              <ul className="flex flex-col gap-2">
                {unplaced.map((i) => (
                  <TrayRow
                    key={i.code}
                    row={{
                      code: i.code,
                      title: i.title,
                      credits: i.credits,
                      note: i.taken?.grade
                        ? `Grade ${i.taken.grade}`
                        : undefined,
                    }}
                    options={options}
                    onAdd={onAdd}
                  />
                ))}
              </ul>
            </>
          ) : (
            <p className="text-[12.5px] text-cc-muted">
              Every taken course has a period. A course you took but didn't pass
              isn't on your transcript: add it from Search to the period you
              took it.
            </p>
          )
        ) : null}
        {tab === "programme" ? (
          electives.length ? (
            <div className="flex flex-col gap-3">
              {[...byYear.entries()]
                .sort((a, b) => a[0] - b[0])
                .map(([year, rows]) => (
                  <div key={year}>
                    <h4 className="mb-1.5 font-medium text-[12px] text-cc-muted">
                      Year {year}
                    </h4>
                    <ul className="flex flex-col gap-2">
                      {rows.map((r) => (
                        <TrayRow
                          key={r.code}
                          row={{
                            code: r.code,
                            title: titleOf(r.code, r.name),
                            credits: r.credits,
                            note: [
                              CATEGORY[r.category],
                              r.track,
                              noteInEnglish(r.note),
                            ]
                              .filter(Boolean)
                              .join(" · "),
                          }}
                          options={options}
                          onAdd={onAdd}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-[12.5px] text-cc-muted">
              Your syllabus lists no electives that aren't already in your plan.
            </p>
          )
        ) : null}
        {tab === "saved" ? (
          saved.length ? (
            <ul className="flex flex-col gap-2">
              {saved.map((r) => (
                <TrayRow key={r.code} row={r} options={options} onAdd={onAdd} />
              ))}
            </ul>
          ) : (
            <p className="text-[12.5px] text-cc-muted">
              Courses you save on Explore show up here, ready to drag in.
            </p>
          )
        ) : null}
        {tab === "search" ? (
          <div className="flex flex-col gap-2.5">
            <div className="relative">
              <Search
                aria-hidden
                size={15}
                className="-translate-y-1/2 absolute top-1/2 left-3 text-cc-muted"
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Course code or name"
                aria-label="Search courses"
                className={cn(fieldClass, "pl-9")}
              />
            </div>
            <ul className="flex flex-col gap-2">
              {(search.data?.results ?? [])
                .filter((r) => !inPlan.has(r.courseCode))
                .map((r) => (
                  <TrayRow
                    key={r.courseCode}
                    row={{
                      code: r.courseCode,
                      title: r.titleEng,
                      credits: r.credits,
                    }}
                    options={options}
                    onAdd={onAdd}
                  />
                ))}
            </ul>
            {q.trim().length >= 2 &&
            search.data &&
            !search.data.results.length ? (
              <p className="text-[12.5px] text-cc-muted">
                No course matches “{q}”.
              </p>
            ) : null}
          </div>
        ) : null}
        {tab === "out" ? (
          leftOut.length ? (
            <ul className="flex flex-col gap-2">
              {leftOut.map((i) => (
                <li
                  key={i.code}
                  className="flex items-center gap-3 rounded-[10px] border border-cc-rule px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-mono text-[11.5px] text-cc-brand">
                      {i.code}
                    </span>
                    <div className="truncate text-[12.5px] text-cc-ink">
                      {i.title}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onInclude(i.code)}
                    className="h-8 shrink-0 cursor-pointer rounded-[8px] border border-cc-rule2 px-2.5 text-[12px] text-cc-ink hover:bg-cc-pill"
                  >
                    Include again
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12.5px] text-cc-muted">
              Nothing is left out. A course you leave out stops counting toward
              your credits, but still counts as a prerequisite you've met.
            </p>
          )
        ) : null}
      </div>
    </section>
  );
}
