"use client";

import {
  Info,
  LocateFixed,
  Plus,
  Search,
  Split,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import Link from "next/link";
import { type DragEvent, type ReactNode, useState } from "react";
import { useCourseStats } from "@/features/courses";
import { cn } from "@/lib/utils";
import type { CourseStats } from "@/types";
import type { CourseLevel, PlanCategory } from "@/types/programme";
import {
  useCourseSearch,
  useCurrentRounds,
  usePlanFacts,
} from "../api/queries";
import {
  type PlanItem,
  roundStart,
  type TemplateCourse,
} from "../lib/build-plan";
import { type Period, type Slot, slotLabel } from "../lib/slots";
import { DRAG_TYPE } from "./course-bar";
import { PeriodStrip } from "./period-strip";
import { fieldClass } from "./plan-setup";
import { SlotPicker } from "./slot-picker";
import { StatusPill } from "./status-pill";

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
  /** The syllabus's category, e.g. "Conditionally elective". */
  tag?: string;
  note?: string;
  /** Courses that can't count toward the degree together with this one. */
  overlapsWith?: string[];
  /** Where a course already in the plan sits ("VT 2027 P4", "To place", "Left out"). */
  where?: string;
};

/** An action that isn't adding: the outlined twin of the "Add to plan" button. */
const ROW_ACTION =
  "inline-flex h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-cc-rule2 px-3.5 text-[13px] text-cc-ink hover:bg-cc-pill";

/** Adding straight into the period the student picked on the grid: the filled twin of "Add to plan". */
const ADD_ACTION =
  "inline-flex h-9 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-cc-btn px-3.5 font-medium text-[13px] text-cc-btn-fg hover:opacity-90";

const periodName = (p: Period) => (p === 5 ? "summer" : `P${p}`);

const NO_STATS: Readonly<Record<string, CourseStats>> = {};

/** What the tray knows about a course beyond its row: level and the periods it starts in. */
export type DescribeCourse = (code: string) => {
  level: CourseLevel | null;
  starts: Period[];
};

const LEVEL: Record<CourseLevel, string> = {
  B: "Basic",
  A: "Advanced",
  P: "Preparatory",
};

const fmtScore = (n: number) => n.toFixed(1);

/** Categories short enough for a pill; the full word stays in the tooltip. */
const SHORT_TAG: Record<string, string> = {
  "Conditionally elective": "Conditional",
};

/**
 * One course, laid out like a course card: what it is, when it runs, what
 * students say, and two actions — read about it, and add it to a period (or,
 * in Saved and Left out, `action`). Every tab draws its courses with this, and
 * the whole row drags onto the grid.
 */
function TrayRow({
  row,
  describe,
  stats,
  options,
  onAdd,
  action,
}: {
  row: Row;
  describe: DescribeCourse;
  stats: CourseStats | undefined;
  options: SlotOption[];
  onAdd: (code: string, slot: Slot) => void;
  /** Replaces "Add to plan" for a course that is already in the plan. */
  action?: ReactNode;
}) {
  const onDragStart = (e: DragEvent) => {
    e.dataTransfer.setData(DRAG_TYPE, row.code);
    e.dataTransfer.setData("text/plain", row.code);
    e.dataTransfer.effectAllowed = "copyMove";
  };
  const { level, starts } = describe(row.code);
  const reviews = stats?.reviews ?? null;
  return (
    <li
      draggable
      onDragStart={onDragStart}
      className="cursor-grab rounded-[14px] border border-cc-rule bg-cc-surface px-4 py-3.5 transition-[box-shadow,border-color] duration-150 hover:border-cc-rule2 hover:shadow-[0_8px_20px_-14px_rgba(20,30,45,0.45)] active:cursor-grabbing motion-reduce:transition-none"
    >
      {/* Where it sits, or else its syllabus category, in the corner, as a course bar's status does. */}
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 font-semibold text-[14px] text-cc-ink leading-snug">
          <span className="mr-1.5 font-mono font-normal text-[12.5px] text-cc-brand">
            {row.code}
          </span>
          {row.title}
        </p>
        {row.where ? (
          <StatusPill tone="brand" size="sm" className="mt-px">
            {row.where}
          </StatusPill>
        ) : row.tag ? (
          <StatusPill
            tone="outline"
            size="sm"
            title={row.tag}
            className="mt-px"
          >
            {SHORT_TAG[row.tag] ?? row.tag}
          </StatusPill>
        ) : null}
      </div>
      {/* Facts as shapes, not a sentence: size and level as pills, and when it runs as a period strip. */}
      <div className="mt-2 flex items-start justify-between gap-2">
        {/* The pills may wrap among themselves; the strip keeps its place on the first line. */}
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {row.credits ? (
            <StatusPill tone="neutral" size="sm">
              {row.credits.toLocaleString("sv-SE")} hp
            </StatusPill>
          ) : null}
          {level ? (
            <StatusPill tone="neutral" size="sm">
              {LEVEL[level]}
            </StatusPill>
          ) : null}
        </div>
        <PeriodStrip starts={starts} className="shrink-0" />
      </div>
      {row.note ? (
        <p className="mt-1.5 text-[11.5px] text-cc-muted">{row.note}</p>
      ) : null}
      {row.overlapsWith?.length ? (
        <p className="mt-2 flex flex-wrap items-center gap-1 text-[11.5px] text-cc-muted">
          <Split aria-hidden size={12} className="mr-0.5 shrink-0" />
          Can't count together with
          {row.overlapsWith.map((c) => (
            <span
              key={c}
              className="rounded-full bg-cc-pill px-1.5 py-px font-mono text-[10.5px] text-cc-chip-ink"
            >
              {c}
            </span>
          ))}
        </p>
      ) : null}
      {reviews ? (
        <div className="mt-2 flex flex-col gap-0.5 text-[12.5px] text-cc-muted tabular-nums">
          <p className="flex flex-wrap gap-x-4">
            <span>
              Learning{" "}
              <b className="font-semibold text-cc-ink">
                {fmtScore(reviews.learningMean)}
              </b>
            </span>
            <span>
              Workload{" "}
              <b className="font-semibold text-cc-ink">
                {fmtScore(reviews.workloadMean)}
              </b>
            </span>
          </p>
          <p className="flex flex-wrap gap-x-4">
            <span>
              <b className="font-semibold text-cc-ink">
                {reviews.happyPercent}%
              </b>{" "}
              glad they took it
            </span>
            <span>
              {reviews.reviewCount} review{reviews.reviewCount === 1 ? "" : "s"}
            </span>
          </p>
        </div>
      ) : stats ? (
        <p className="mt-2 text-[12.5px] text-cc-muted">No reviews yet</p>
      ) : null}
      <div className="mt-3 flex items-center gap-2">
        <Link
          href={`/search?open=${encodeURIComponent(row.code)}`}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] text-cc-ink hover:bg-cc-pill"
        >
          <Info aria-hidden size={15} /> Details
        </Link>
        {action ?? (
          <SlotPicker
            options={options}
            starts={starts}
            onPick={(slot) => onAdd(row.code, slot)}
            label="Add to plan"
            variant="button"
            ariaLabel={`Add ${row.code} to a period`}
            className="flex-1"
          />
        )}
      </div>
    </li>
  );
}

/** The syllabus's remarks are Swedish; only "Endast en av …" carries a rule, so only that one is kept. */
function overlapsIn(note: string, own: string): string[] {
  if (!/endast en av|bara en av/i.test(note)) return [];
  const codes = note.match(/\b[A-Z]{2}\d{3}[0-9A-Z]\b/g) ?? [];
  return [...new Set(codes)].filter((c) => c !== own);
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
  /** Takes a left-out course the student added out of the plan altogether. */
  onRemoveOut?: (code: string) => void;
  /** Selects a course that is already in the plan, opening its detail. */
  onShow: (code: string) => void;
  /** Where a course already in the plan sits ("VT 2027 P4", "To place", "Left out"). */
  whereOf: (code: string) => string | undefined;
  /** A track's name as shown, from the Swedish heading the syllabus rows carry. */
  trackOf?: (track: string) => string;
  /** A course's English title, falling back to the syllabus's Swedish one. */
  titleOf: (code: string, fallback: string) => string;
  describe: DescribeCourse;
  /** Review numbers the page already holds, keyed by course code; only search hits outside it are fetched here. */
  knownStats?: Readonly<Record<string, CourseStats>>;
  /**
   * A period chosen from the grid's "Add course": the lists keep the courses
   * given then, and a row's button adds straight into it.
   */
  target: Slot | null;
  /** The study year `target` falls in, so that year's electives come first. */
  targetYear?: number | null;
  onClearTarget: () => void;
};

/**
 * Where courses come from: taken courses still to place, the syllabus's
 * electives, saved courses, a search, and what was left out. Every row drags
 * onto the grid and has "Add to plan", so nothing needs a pointer. Opened
 * from an empty period, it works the other way round: what fits that period.
 */
export function CourseTray({
  unplaced,
  electives,
  saved,
  leftOut,
  options,
  onAdd,
  onInclude,
  onRemoveOut,
  onShow,
  whereOf,
  titleOf,
  trackOf = (t) => t,
  describe,
  knownStats = NO_STATS,
  target,
  targetYear = null,
  onClearTarget,
}: Props) {
  const [tab, setTab] = useState<Tab>(unplaced.length ? "place" : "programme");
  const [q, setQ] = useState("");
  const search = useCourseSearch(q);
  // Courses not given in the chosen period are hidden until asked for.
  const [showAll, setShowAll] = useState(false);
  const [seenTarget, setSeenTarget] = useState(target);
  if (target !== seenTarget) {
    setSeenTarget(target);
    setShowAll(false);
    if (target) setTab("programme");
  }
  const tabs: [Tab, string][] = [
    ["place", "To place"],
    ["programme", "Programme"],
    ["saved", "Saved"],
    ["search", "Search"],
    ["out", "Left out"],
  ];
  // A hit already in the plan stays in the results, marked: dropping it left a blank list.
  const results = search.data?.results ?? [];
  const showAction = (code: string) => (
    <button type="button" onClick={() => onShow(code)} className={ROW_ACTION}>
      <LocateFixed aria-hidden size={15} /> Show in plan
    </button>
  );
  // Review numbers come with the page; a search hit outside the plan is the one thing to fetch here.
  const hitStats = useCourseStats(
    tab === "search"
      ? results.map((r) => r.courseCode).filter((c) => !(c in knownStats))
      : [],
  ).data;
  // Search results aren't in the plan, so the plan has no facts for them: fetch
  // level and this year's rounds for the hits on screen.
  const hitCodes = tab === "search" ? results.map((r) => r.courseCode) : [];
  const hitFacts = usePlanFacts(hitCodes).data;
  const hitRounds = useCurrentRounds(hitCodes).data;
  const describeAny: DescribeCourse = (code) => {
    const known = describe(code);
    if (known.level || known.starts.length) return known;
    const f = hitFacts?.courses[code];
    const credits = [
      ...(hitRounds?.courses[code] ?? []).map((r) => r.credits),
      ...(f?.rounds ?? []).map((r) => r.credits),
    ];
    return {
      level: f?.level ?? null,
      starts: [
        ...new Set(
          credits.map(roundStart).filter((p): p is Period => p !== null),
        ),
      ].sort(),
    };
  };
  const fits = (code: string) =>
    !target || showAll || describeAny(code).starts.includes(target.p);
  const shownElectives = electives.filter((e) => fits(e.code));
  const toAdd = saved.filter((r) => !r.where);
  const shownSaved = toAdd.filter((r) => fits(r.code));
  const hidden =
    tab === "programme"
      ? electives.length - shownElectives.length
      : tab === "saved"
        ? toAdd.length - shownSaved.length
        : 0;
  const byYear = new Map<number, TemplateCourse[]>();
  for (const e of shownElectives)
    byYear.set(e.studyYear, [...(byYear.get(e.studyYear) ?? []), e]);
  const rowProps = (code: string) => ({
    describe: describeAny,
    stats: knownStats[code] ?? hitStats[code],
    options,
    onAdd,
    action: target ? (
      <button
        type="button"
        onClick={() => {
          onAdd(code, target);
          onClearTarget();
        }}
        className={ADD_ACTION}
      >
        <Plus aria-hidden size={15} strokeWidth={2.4} /> Add to{" "}
        {periodName(target.p)}
      </button>
    ) : undefined,
  });
  const showHidden = hidden ? (
    <button
      type="button"
      onClick={() => setShowAll(true)}
      className="mt-2.5 cursor-pointer text-[12px] text-cc-brand underline-offset-2 hover:underline"
    >
      Show {hidden} not given in {target ? periodName(target.p) : ""}
    </button>
  ) : null;

  return (
    <section
      aria-label="Courses to add"
      className="rounded-[16px] border border-cc-rule bg-cc-surface"
    >
      {target ? (
        <div className="m-3 mb-0 flex items-center justify-between gap-2 rounded-[12px] bg-cc-checked-tint py-1.5 pr-1.5 pl-3 text-[12.5px] text-cc-ink">
          <span className="min-w-0">
            Adding to <b className="font-semibold">{slotLabel(target)}</b>
            {showAll ? null : (
              <span className="text-cc-muted"> · given then</span>
            )}
          </span>
          <button
            type="button"
            onClick={onClearTarget}
            aria-label="Stop choosing for this period"
            className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-cc-muted hover:bg-cc-pill hover:text-cc-ink"
          >
            <X aria-hidden size={14} />
          </button>
        </div>
      ) : null}
      <div
        role="tablist"
        aria-label="Course lists"
        className="scrollbar-hidden m-3 mb-0 flex gap-0.5 overflow-x-auto overflow-y-hidden rounded-full bg-cc-pill p-1"
      >
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "relative flex flex-1 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[12px] transition-colors duration-150",
              tab === id
                ? "bg-cc-surface font-semibold text-cc-ink shadow-[0_1px_3px_rgba(20,30,45,0.12)]"
                : "text-cc-muted hover:text-cc-ink",
            )}
          >
            {label}
            {/* Taken courses still waiting for a period: a dot, not a count. */}
            {id === "place" && unplaced.length ? (
              <>
                <span
                  aria-hidden
                  className="size-1.5 rounded-full bg-cc-score-workload"
                />
                <span className="sr-only">, courses waiting</span>
              </>
            ) : null}
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
              <ul className="flex flex-col gap-2.5">
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
                    {...rowProps(i.code)}
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
          shownElectives.length ? (
            <div className="flex flex-col gap-3">
              {[...byYear.entries()]
                // Filling a period, its own year's electives first, then the nearest years.
                .sort(
                  (a, b) =>
                    (targetYear === null
                      ? 0
                      : Math.abs(a[0] - targetYear) -
                        Math.abs(b[0] - targetYear)) || a[0] - b[0],
                )
                .map(([year, rows]) => (
                  <div key={year}>
                    <h4 className="mb-1.5 font-medium text-[12px] text-cc-muted">
                      Year {year}
                    </h4>
                    <ul className="flex flex-col gap-2.5">
                      {rows.map((r) => (
                        <TrayRow
                          key={r.code}
                          row={{
                            code: r.code,
                            title: titleOf(r.code, r.name),
                            credits: r.credits,
                            tag: CATEGORY[r.category],
                            note: r.track ? trackOf(r.track) : undefined,
                            overlapsWith: overlapsIn(r.note, r.code),
                          }}
                          {...rowProps(r.code)}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-[12.5px] text-cc-muted">
              {target && electives.length
                ? `None of your programme's electives starts in ${periodName(target.p)}. Saved and Search may have one.`
                : "Your syllabus lists no electives that aren't already in your plan."}
            </p>
          )
        ) : null}
        {tab === "programme" || tab === "saved" ? showHidden : null}
        {tab === "saved" ? (
          saved.length ? (
            <div className="flex flex-col gap-3">
              {shownSaved.length ? (
                <ul className="flex flex-col gap-2.5">
                  {shownSaved.map((r) => (
                    <TrayRow key={r.code} row={r} {...rowProps(r.code)} />
                  ))}
                </ul>
              ) : null}
              {/* A saved course already in the plan stays listed: hiding it read as "nothing saved". */}
              {saved.some((r) => r.where) ? (
                <div>
                  <h4 className="mb-1.5 font-medium text-[12px] text-cc-muted">
                    Already in your plan
                  </h4>
                  <ul className="flex flex-col gap-2.5">
                    {saved
                      .filter((r) => r.where)
                      .map((r) => (
                        <TrayRow
                          key={r.code}
                          row={r}
                          {...rowProps(r.code)}
                          action={showAction(r.code)}
                        />
                      ))}
                  </ul>
                </div>
              ) : null}
            </div>
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
            <ul className="flex flex-col gap-2.5">
              {results.map((r) => {
                const where = whereOf(r.courseCode);
                return (
                  <TrayRow
                    key={r.courseCode}
                    row={{
                      code: r.courseCode,
                      title: r.titleEng,
                      credits: r.credits,
                      where,
                    }}
                    {...rowProps(r.courseCode)}
                    {...(where ? { action: showAction(r.courseCode) } : {})}
                  />
                );
              })}
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
            <ul className="flex flex-col gap-2.5">
              {leftOut.map((i) => (
                <TrayRow
                  key={i.code}
                  row={{
                    code: i.code,
                    title: i.title,
                    credits: i.credits,
                    tag: i.category ? CATEGORY[i.category] : undefined,
                  }}
                  {...rowProps(i.code)}
                  action={
                    <>
                      <button
                        type="button"
                        onClick={() => onInclude(i.code)}
                        className={ROW_ACTION}
                      >
                        <Undo2 aria-hidden size={15} /> Include again
                      </button>
                      {/* A course the student added, never passed, can leave the plan for good; a syllabus or taken one only waits here. */}
                      {onRemoveOut && !i.mandatory && !i.taken ? (
                        <button
                          type="button"
                          onClick={() => onRemoveOut(i.code)}
                          aria-label={`Remove ${i.code} from the plan`}
                          title="Remove from plan"
                          className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-cc-rule2 text-cc-muted hover:bg-cc-pill hover:text-cc-danger-ink"
                        >
                          <Trash2 aria-hidden size={15} />
                        </button>
                      ) : null}
                    </>
                  }
                />
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
