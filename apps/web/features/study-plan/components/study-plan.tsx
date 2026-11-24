"use client";

import {
  ChevronRight,
  Download,
  GraduationCap,
  Settings2,
  TriangleAlert,
  Upload,
} from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { authHref, useSessionData } from "@/features/auth";
import {
  useCourseStats,
  useMarkCourseTaken,
  useTakenCourses,
} from "@/features/courses";
import { useGuestSaves } from "@/features/saved";
import { useTakenMutations } from "@/features/taken";
import { cn } from "@/lib/utils";
import type { CurrentRound, PlanFactsResult } from "@/types/programme";
import {
  useCurrentRounds,
  useDegreeProjects,
  useMasterRequirements,
  usePlanFacts,
  useProgramme,
  useProgrammes,
  useSavedCodes,
} from "../api/queries";
import { usePlanStore } from "../hooks/use-plan-store";
import {
  buildPlan,
  codesNeedingFacts,
  intakeOf,
  offeredStartsOf,
  type PlanItem,
  type TakenRow,
} from "../lib/build-plan";
import {
  type CheckFix,
  checkPlan,
  firstPeriodBefore,
  type PlanCheck,
  periodLoad,
} from "../lib/check-plan";
import { isOpenEntrance, withContinuation } from "../lib/open-entrance";
import type { PlanSetup as Setup } from "../lib/plan-storage";
import { computeProgress } from "../lib/progress";
import {
  intakeLabel,
  type Period,
  type Slot,
  slotIndex,
  slotLabel,
  slotOf,
  termLabel,
} from "../lib/slots";
import { trackLabel, trackNamesIn } from "../lib/tracks";
import { CatchUpCard, type CatchUpCourse } from "./catch-up-card";
import { CourseDetail } from "./course-detail";
import { CourseTray, type SlotOption } from "./course-tray";
import { PlanSetup } from "./plan-setup";
import { ProgressPanel } from "./progress-panel";
import { StatusPill } from "./status-pill";
import { YearRow } from "./year-row";

const NO_FACTS: PlanFactsResult = { courses: {}, refs: {} };
const NO_TAKEN: TakenRow[] = [];
const NO_ROUNDS: Record<string, CurrentRound[]> = {};
const noSubscribe = () => () => {};

type SideTab = "progress" | "courses";

/**
 * /plan: the whole degree on one screen.
 *
 * The page itself never scrolls; the year grid and the side column each
 * scroll on their own, so the progress panel stays beside the year being
 * planned. The plan lives in this browser (`lib/plan-storage.ts`); taken
 * courses come from the account on every render and are never copied in.
 */
export function StudyPlan() {
  const session = useSessionData();
  const owner = session.userId;
  const signedIn = session.isAuthenticated;
  const {
    state,
    saveSetup,
    place,
    leaveOut,
    dismiss,
    exportPlan,
    importPlan,
    reset,
  } = usePlanStore(owner);
  const setup = state.setup;
  const [editing, setEditing] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"plan" | "side">("plan");
  const [sideTab, setSideTab] = useState<SideTab>("progress");
  /** The period a student chose to fill from the grid; the course list then shows what fits it. */
  const [addTarget, setAddTarget] = useState<Slot | null>(null);
  // The session is unknown on the server, so a signed-out prompt waits until after hydration
  // rather than appearing in the browser's first render and not the server's.
  const hydrated = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  const showSignIn = hydrated && !signedIn && !session.isPending;
  const fileRef = useRef<HTMLInputElement>(null);
  const now = useMemo(() => slotOf(new Date()), []);

  const programmes = useProgrammes();
  const ownProgramme = useProgramme(setup?.programme ?? null).data ?? null;
  const nextProgramme = useProgramme(setup?.continuation ?? null).data ?? null;
  // An open entrance's year 1 and the programme chosen for years 2–5, as the one
  // programme the student follows: everything below plans against it.
  const programme = useMemo(
    () =>
      ownProgramme &&
      nextProgramme &&
      setup?.intake &&
      isOpenEntrance(ownProgramme, setup.intake)
        ? withContinuation(ownProgramme, nextProgramme, setup.intake)
        : ownProgramme,
    [ownProgramme, nextProgramme, setup?.intake],
  );
  const isCiving = programme?.summary.type === "CING";
  const master =
    useProgramme(isCiving ? (setup?.master ?? null) : null).data ?? null;
  const takenQuery = useTakenCourses(signedIn);
  const taken: TakenRow[] = takenQuery.data ?? NO_TAKEN;
  const accountSaved = useSavedCodes(signedIn).data;
  const guestSaved = useGuestSaves();
  const savedCodes = signedIn ? (accountSaved ?? []) : guestSaved;
  const markTaken = useMarkCourseTaken();
  const takenWrites = useTakenMutations();
  const asideRef = useRef<HTMLElement>(null);

  const [factsCodes, setFactsCodes] = useState<string[]>([]);
  const factsQuery = usePlanFacts(factsCodes);
  const facts = factsQuery.data ?? NO_FACTS;
  const currentRounds = useCurrentRounds(factsCodes).data?.courses ?? NO_ROUNDS;
  const masterReq = useMasterRequirements(
    setup?.master ? [setup.master] : [],
  ).data;

  const plan = useMemo(
    () =>
      setup
        ? buildPlan({
            setup,
            programme,
            master,
            taken,
            facts,
            state,
            now,
            knowsTranscript: signedIn,
            currentRounds,
          })
        : null,
    [
      setup,
      programme,
      master,
      taken,
      facts,
      state,
      now,
      signedIn,
      currentRounds,
    ],
  );

  // Review numbers for every course this page can show — the plan, the syllabus's electives,
  // saved and left-out courses — in one request when the plan loads. Asked per click or per
  // tab instead, each selection waited on its own round trip.
  const statsCodes = useMemo(
    () =>
      plan
        ? [
            ...new Set([
              ...[...plan.items, ...plan.unplaced, ...plan.leftOut].map(
                (i) => i.code,
              ),
              ...plan.electives.map((e) => e.code),
              ...savedCodes,
            ]),
          ].sort()
        : [],
    [plan, savedCodes],
  );
  const planStats = useCourseStats(statsCodes);

  // The facts to ask for follow from the plan — its courses, the syllabus's electives and the
  // master's required courses, so every name shows in English — and are asked again only when that set changes.
  const wanted = useMemo(() => {
    if (!plan) return [];
    const required =
      setup?.master && programme
        ? Object.entries(
            masterReq?.masters[setup.master]?.civing?.sections ?? {},
          )
            .filter(([p]) => p === programme.summary.code || p === "*")
            .flatMap(([, rows]) => rows.flatMap((r) => r.codes))
        : [];
    // The courses a plan course asks for first, so a missing one can be offered in a period it's given.
    const prerequisites = plan.items.flatMap(
      (i) => facts.courses[i.code]?.prerequisites.flatMap((g) => g.codes) ?? [],
    );
    return codesNeedingFacts(plan, taken, savedCodes, required, prerequisites);
  }, [plan, taken, savedCodes, masterReq, setup, programme, facts]);
  if (wanted.join() !== factsCodes.join()) setFactsCodes(wanted);

  const projectCodes = useMemo(
    () =>
      plan
        ? [...plan.template.keys(), ...plan.items.map((i) => i.code)].filter(
            (c) => /X$/.test(c),
          )
        : [],
    [plan],
  );
  const projects =
    useDegreeProjects([...new Set(projectCodes)].slice(0, 60)).data ?? {};

  const checks = useMemo(
    () =>
      plan
        ? checkPlan(
            plan,
            facts,
            state,
            now,
            plan.passedCodes,
            programme?.summary.type === "TMAST",
            (code) =>
              offeredStartsOf(code, {
                programme,
                master,
                currentRounds,
                facts,
              }),
          )
        : [],
    [plan, facts, state, now, programme, master, currentRounds],
  );
  // An open-entrance student's catching up: the continuation's year-1 courses
  // that a prerequisite warning points to and the plan doesn't hold yet.
  const catchUp = useMemo((): CatchUpCourse[] => {
    if (
      !plan ||
      !ownProgramme ||
      !nextProgramme ||
      !setup?.intake ||
      !isOpenEntrance(ownProgramme, setup.intake)
    )
      return [];
    const have = new Set([
      ...[...plan.items, ...plan.unplaced].map((i) => i.code),
      ...plan.passedCodes,
    ]);
    const missing = checks.filter(
      (c) => c.rule === "prerequisite" && c.severity === "warning" && c.code,
    );
    const out: CatchUpCourse[] = [];
    for (const row of intakeOf(nextProgramme, setup.intake)?.years["1"] ?? []) {
      if (have.has(row.code)) continue;
      const neededBy = [
        ...new Set(
          missing
            .filter((c) => c.needs?.includes(row.code))
            .map((c) => c.code as string),
        ),
      ];
      if (!neededBy.length) continue;
      // The courses that need it, the first to start first.
      const startOf = (code: string) =>
        plan.items.find((i) => i.code === code)?.startIdx ??
        Number.POSITIVE_INFINITY;
      neededBy.sort((a, b) => startOf(a) - startOf(b));
      const starts = offeredStartsOf(row.code, {
        programme,
        master,
        currentRounds,
        facts,
      });
      const inTime = firstPeriodBefore(starts, now, startOf(neededBy[0]));
      // Where none fits before, still the first period it's given: the course after it then moves.
      const earliest =
        inTime ?? firstPeriodBefore(starts, now, (now.ay + 6) * 10);
      out.push({
        code: row.code,
        title: facts.courses[row.code]?.titleEng || row.name,
        neededBy,
        slot: earliest,
        late: !inTime && !!earliest,
      });
    }
    return out;
  }, [
    plan,
    ownProgramme,
    nextProgramme,
    setup?.intake,
    checks,
    facts,
    programme,
    master,
    currentRounds,
    now,
  ]);
  const progress = useMemo(
    () =>
      plan && setup
        ? computeProgress({
            setup,
            plan,
            programme,
            master,
            eligibility: masterReq?.masters[setup.master ?? ""] ?? null,
            areas: masterReq?.areas ?? [],
            projects,
            facts,
            now,
          })
        : [],
    [plan, setup, programme, master, masterReq, projects, facts, now],
  );
  const load = useMemo(() => periodLoad(plan?.items ?? []), [plan]);
  const warningsByCode = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of checks)
      if (c.code && c.severity === "warning")
        m.set(c.code, (m.get(c.code) ?? 0) + 1);
    return m;
  }, [checks]);

  const periods: Period[] = setup?.summer ? [1, 2, 3, 4, 5] : [1, 2, 3, 4];
  const startAy = plan?.startAy ?? null;
  const options: SlotOption[] = useMemo(() => {
    if (!plan || startAy === null) return [];
    const out: SlotOption[] = [];
    for (let y = 1; y <= plan.years; y++)
      for (const p of periods) {
        const slot = { ay: startAy + y - 1, p };
        out.push({
          value: `${slot.ay}:${p}`,
          label: `Year ${y} · ${p === 5 ? "Summer" : `P${p}`} · ${termLabel(slot)}`,
          slot,
        });
      }
    return out;
  }, [plan, startAy, periods]);

  const allItems = plan
    ? [...plan.items, ...plan.unplaced, ...plan.leftOut]
    : [];
  const selectedItem = allItems.find((i) => i.code === selected) ?? null;
  // Selecting a course brings its detail, at the top of the side column, into view.
  // After a tick, so the detail card is laid out and scroll anchoring (which keeps
  // the visible content still when the card is inserted above it) has settled.
  useEffect(() => {
    if (!selected && !addTarget) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const timer = window.setTimeout(() =>
      asideRef.current?.scrollTo({
        top: 0,
        behavior: reduce ? "auto" : "smooth",
      }),
    );
    return () => window.clearTimeout(timer);
  }, [selected, addTarget]);

  // ---- Actions, each with an undo. ----
  const undoable = (message: string, undo: () => void) =>
    toast(message, {
      action: { label: "Undo", onClick: undo },
      duration: 8000,
    });
  const moveCourse = (code: string, slot: Slot) => {
    const before = state.placements[code] ?? null;
    if (before && slotIndex(before) === slotIndex(slot)) return;
    place(code, slot);
    if (leftOutHas(code)) leaveOut(code, false);
    setSelected(code);
    undoable(
      `${code} ${before ? "moved" : "added"} to ${slotLabel(slot)}.`,
      () => place(code, before),
    );
  };
  const leftOutHas = (code: string) => state.leftOut.includes(code);
  /**
   * Takes a course the student added out of the plan altogether, left-out mark
   * and all, so it goes back to the course list instead of sitting in Left out.
   */
  const removeCourse = (item: PlanItem) => {
    const before = state.placements[item.code] ?? null;
    const wasOut = state.leftOut.includes(item.code);
    place(item.code, null);
    if (wasOut) leaveOut(item.code, false);
    setSelected(null);
    undoable(`${item.code} removed from the plan.`, () => {
      if (before) place(item.code, before);
      if (wasOut) leaveOut(item.code, true);
    });
  };
  /** The syllabus's plan again: mandatory courses in their own periods, passed courses where they were taken. */
  const resetPlan = () => {
    const before = exportPlan();
    reset(new Set(plan?.passedCodes ?? []));
    setConfirmReset(false);
    setSelected(null);
    setAddTarget(null);
    undoable("Your plan is back to the syllabus.", () => importPlan(before));
  };
  const removePlacement = (item: PlanItem) => {
    const before = state.placements[item.code] ?? null;
    place(item.code, null);
    setSelected(null);
    if (before)
      undoable(`${item.code} removed from the plan.`, () =>
        place(item.code, before),
      );
  };
  const setLeftOut = (item: PlanItem, out: boolean) => {
    leaveOut(item.code, out);
    if (out) setSelected(null);
    undoable(
      out
        ? `${item.code} no longer counts in this plan. It still counts as a prerequisite you've met.`
        : `${item.code} counts again.`,
      () => leaveOut(item.code, !out),
    );
  };
  const nudge = (item: PlanItem, d: -1 | 1) => {
    if (!item.slot) return;
    const order = options.map((o) => o.slot);
    const i = order.findIndex(
      (s) => slotIndex(s) === slotIndex(item.slot as Slot),
    );
    const next = order[i + d];
    if (next) moveCourse(item.code, next);
  };
  /** The full Taken row, for writes that must restate every field. */
  const takenRow = (code: string) =>
    takenQuery.data?.find((t) => t.courseCode === code) ?? null;
  const writeResult = (
    code: string,
    grade: string | null,
    earnedCredits: number | null,
    message: string,
    undo?: () => void,
  ) => {
    const row = takenRow(code);
    if (!row) return;
    takenWrites.update.mutate(
      {
        courseCode: code,
        grade,
        earnedCredits,
        attendancePeriods: row.attendancePeriods,
        attendanceYear: row.attendanceYear,
      },
      {
        onSuccess: () => (undo ? undoable(message, undo) : toast(message)),
        onError: () => toast("That didn't save. Try again."),
      },
    );
  };
  /**
   * A taken course is attended, not necessarily passed. Marking it failed
   * writes a failing grade to Taken courses, so the plan and the Taken page
   * agree; undo puts back the grade it had.
   */
  const markFailed = (item: PlanItem) => {
    const row = takenRow(item.code);
    if (!row) return;
    writeResult(
      item.code,
      "F",
      row.earnedCredits,
      `${item.code} marked as failed. It no longer counts toward your credits.`,
      () =>
        writeResult(
          item.code,
          row.grade,
          row.earnedCredits,
          `${item.code} restored.`,
        ),
    );
  };
  const markPassed = (item: PlanItem) => {
    const row = takenRow(item.code);
    // Already in Taken with a failing grade or partial credits: clear those, keep the rest.
    if (row) {
      writeResult(item.code, null, null, `${item.code} marked as passed.`, () =>
        writeResult(
          item.code,
          row.grade,
          row.earnedCredits,
          `${item.code} restored.`,
        ),
      );
      return;
    }
    const end = item.segments.at(-1)?.slot;
    markTaken.mutate(
      {
        courseCode: item.code,
        attendanceYear: end ? (end.p >= 3 ? end.ay + 1 : end.ay) : null,
      },
      {
        onSuccess: () => toast(`${item.code} added to your taken courses.`),
        onError: () => toast("That didn't save. Try again."),
      },
    );
  };
  const onFix = (check: PlanCheck, fix: CheckFix) => {
    const item = allItems.find((i) => i.code === check.code);
    if (!item) return;
    if (fix.kind === "move") moveCourse(item.code, fix.slot);
    else if (fix.kind === "remove") removePlacement(item);
    else if (fix.kind === "include") setLeftOut(item, false);
    else if (fix.kind === "place") moveCourse(fix.code, fix.slot);
  };

  /** Where a course already in the plan sits, for the course lists; undefined when it isn't. */
  const whereOf = (code: string) => {
    const item = allItems.find((i) => i.code === code);
    if (!item) return undefined;
    if (item.slot) return slotLabel(item.slot);
    return plan?.leftOut.some((i) => i.code === code) ? "Left out" : "To place";
  };
  // Every saved course, with where it sits when the plan already has it.
  const savedRows = savedCodes.map((c) => {
    const item = allItems.find((i) => i.code === c);
    return {
      code: c,
      title: facts.courses[c]?.titleEng ?? item?.title ?? c,
      credits: facts.courses[c]?.credits ?? item?.credits ?? null,
      where: whereOf(c),
    };
  });

  const onExport = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          { kind: "kth-cc-study-plan", v: 1, plan: exportPlan() },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    // Programme and date in the name, so a second export isn't "study-plan (1).json".
    a.download = `study-plan-${setup?.programme ?? "kth"}-${new Date().toISOString().slice(0, 10)}.json`;
    // Clicked from inside the document and revoked later: Firefox and Safari can
    // ignore a click on a detached link, or fail a download whose URL is revoked
    // before it has started.
    a.hidden = true;
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };
  const onImport = async (file: File) => {
    let plan: Record<string, unknown>;
    try {
      const parsed = JSON.parse(await file.text()) as {
        kind?: string;
        plan?: unknown;
      };
      if (
        parsed.kind !== "kth-cc-study-plan" ||
        !parsed.plan ||
        typeof parsed.plan !== "object" ||
        Array.isArray(parsed.plan)
      )
        throw new Error("not a plan");
      plan = parsed.plan as Record<string, unknown>;
    } catch {
      toast("That file isn't a study plan exported from here.");
      return;
    }
    // An import replaces the plan in this browser, so the one it replaced stays one click away.
    const before = exportPlan();
    importPlan(plan);
    toast(
      "Plan imported.",
      Object.keys(before).length
        ? {
            action: { label: "Undo", onClick: () => importPlan(before) },
            duration: 8000,
          }
        : undefined,
    );
  };

  const saveAndClose = (s: Setup) => {
    saveSetup(s);
    setEditing(false);
  };

  const programmeList = programmes.data?.programmes ?? [];

  // ---- No plan yet: setup. ----
  if (!setup?.programme || !setup.intake) {
    return (
      <div className="scrollbar-subtle h-full overflow-y-auto">
        <div className="mx-auto flex max-w-[620px] flex-col gap-5 px-5 py-8 @3xl/shell:py-12">
          <div>
            <h2 className="font-semibold text-[22px] text-cc-ink">
              Plan your studies
            </h2>
            <p className="mt-1.5 text-[13.5px] text-cc-muted leading-relaxed">
              Pick your programme and intake. Your plan starts from its
              syllabus: the mandatory courses in the periods they're given.
              {signedIn
                ? " The courses on your transcript are already marked as passed."
                : " Sign in to bring in the courses on your transcript."}
            </p>
          </div>
          {showSignIn ? (
            <Link
              href={authHref("/plan")}
              className="self-start rounded-[10px] border border-cc-rule2 px-3.5 py-2 text-[13px] text-cc-ink hover:bg-cc-pill"
            >
              Sign in first
            </Link>
          ) : null}
          <div className="rounded-[16px] border border-cc-rule bg-cc-surface p-6">
            {programmes.isPending ? (
              <p className="text-[13px] text-cc-muted">
                Loading KTH's programmes…
              </p>
            ) : (
              <PlanSetup
                programmes={programmeList}
                initial={setup}
                onSave={saveSetup}
              />
            )}
          </div>
          <p className="text-[12px] text-cc-muted">
            Moving from another browser?{" "}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="cursor-pointer text-cc-brand underline-offset-2 hover:underline"
            >
              Import a plan you exported
            </button>
            .
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            aria-label="Import a plan"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImport(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>
    );
  }

  const summary = programme?.summary;
  const years = plan?.years ?? 0;
  const yearList =
    startAy === null
      ? []
      : Array.from({ length: years }, (_, i) => ({
          y: i + 1,
          ay: startAy + i,
        }));
  const warnings = checks.filter((c) => c.severity === "warning");
  const nowIdx = slotIndex(now);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-5 pb-4 @3xl/shell:px-7 @3xl/shell:pt-6">
        <div className="min-w-0">
          <h2 className="font-semibold text-[20px] text-cc-ink">Study plan</h2>
          {/* The plan's settings at a glance, as pills: programme, intake, and the master's it aims for. */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StatusPill
              tone="neutral"
              title={summary?.nameEn ?? undefined}
              className="max-w-full"
            >
              <span className="truncate">
                {summary
                  ? `${setup.continuation ? `${setup.programme} → ` : ""}${summary.code} · ${summary.nameEn}`
                  : setup.programme}
              </span>
            </StatusPill>
            <StatusPill tone="neutral">
              Started {intakeLabel(setup.intake)}
            </StatusPill>
            {setup.master ? (
              <StatusPill tone="brand" icon={GraduationCap}>
                {isCiving ? "Master's" : "Next"}: {setup.master}
              </StatusPill>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-cc-rule2 bg-cc-surface px-3.5 text-[13px] text-cc-ink hover:bg-cc-pill"
          >
            <Settings2 aria-hidden size={15} /> Plan settings
          </button>
          <button
            type="button"
            onClick={onExport}
            aria-label="Export plan"
            title="Export plan"
            className="flex size-9 cursor-pointer items-center justify-center rounded-full border border-cc-rule2 bg-cc-surface text-cc-ink hover:bg-cc-pill"
          >
            <Download aria-hidden size={15} />
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Import plan"
            title="Import plan"
            className="flex size-9 cursor-pointer items-center justify-center rounded-full border border-cc-rule2 bg-cc-surface text-cc-ink hover:bg-cc-pill"
          >
            <Upload aria-hidden size={15} />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImport(f);
              e.target.value = "";
            }}
          />
        </div>
        <div
          role="tablist"
          aria-label="Plan view"
          className="flex w-full gap-1 rounded-full bg-cc-pill p-1 @7xl/shell:hidden"
        >
          {/* One control on a narrow screen: the plan, or one of the side column's two tabs. */}
          {(
            [
              ["plan", "Plan"],
              ["progress", "Progress"],
              ["courses", "Add courses"],
            ] as const
          ).map(([id, label]) => {
            const on =
              id === "plan"
                ? view === "plan"
                : view === "side" && sideTab === id;
            const dot =
              id === "progress"
                ? warnings.length > 0
                : id === "courses" && (plan?.unplaced.length ?? 0) > 0;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => {
                  if (id === "plan") {
                    setView("plan");
                    return;
                  }
                  setView("side");
                  setSideTab(id);
                  if (id !== "courses") setAddTarget(null);
                }}
                className={cn(
                  "flex h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full text-[13px] transition-colors",
                  on
                    ? "bg-cc-surface font-semibold text-cc-ink shadow-[0_1px_3px_rgba(20,30,45,0.12)]"
                    : "text-cc-muted hover:text-cc-ink",
                )}
              >
                {label}
                {dot ? (
                  <>
                    <span
                      aria-hidden
                      className="size-1.5 rounded-full bg-cc-score-workload"
                    />
                    <span className="sr-only">
                      {id === "progress"
                        ? ", something to sort out"
                        : ", courses waiting"}
                    </span>
                  </>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-6 px-5 pb-5 @3xl/shell:px-7">
        <div
          className={cn(
            "scrollbar-subtle relative min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto pr-1",
            view === "plan" ? "flex" : "hidden",
            "@7xl/shell:flex",
          )}
        >
          {showSignIn ? (
            <div className="rounded-[14px] border border-cc-rule bg-cc-info px-4 py-3 text-[13px] text-cc-ink">
              <Link
                href={authHref("/plan")}
                className="font-medium text-cc-brand underline-offset-2 hover:underline"
              >
                Sign in
              </Link>{" "}
              to bring in the courses on your transcript. Until then every
              course shows as planned.
            </div>
          ) : null}
          {plan?.unplaced.length ? (
            <div className="rounded-[14px] border border-cc-warn-border bg-cc-warn px-4 py-3 text-[13px] text-cc-ink">
              {plan.unplaced.length} taken course
              {plan.unplaced.length === 1 ? "" : "s"} still need
              {plan.unplaced.length === 1 ? "s" : ""} a period. Your transcript
              doesn't say when you took{" "}
              {plan.unplaced.length === 1 ? "it" : "them"}: drag{" "}
              {plan.unplaced.length === 1 ? "it" : "each"} from <b>To place</b>{" "}
              into the period you took it.
            </div>
          ) : null}
          {programme === null ? (
            <p className="text-[13px] text-cc-muted">Loading your programme…</p>
          ) : null}
          {yearList.map(({ y, ay }) => (
            <YearRow
              key={`${ay}-${setup.summer}`}
              ay={ay}
              studyYear={y}
              periods={periods}
              items={
                plan?.items.filter((i) =>
                  i.segments.some((s) => s.slot.ay === ay),
                ) ?? []
              }
              load={load}
              warningsByCode={warningsByCode}
              selected={selected}
              now={now}
              label={
                isCiving
                  ? y <= 3
                    ? "Bachelor part"
                    : `Master's part${setup.master ? ` · ${setup.master}` : ""}`
                  : undefined
              }
              defaultOpen={slotIndex({ ay, p: 4 }) >= nowIdx}
              onDropCourse={moveCourse}
              onSelect={(code) => {
                const opening = selected !== code;
                setSelected(opening ? code : null);
                // On a narrow screen the detail lives in the other tab.
                if (opening) setView("side");
              }}
              onNudge={nudge}
              onClearSelection={() => setSelected(null)}
              addTarget={addTarget}
              onAddTo={(slot) => {
                setAddTarget(slot);
                setSelected(null);
                setSideTab("courses");
                setView("side");
              }}
            />
          ))}
          {plan?.items.some(
            (i) =>
              startAy !== null &&
              (i.segments[0]?.slot.ay ?? 0) >= startAy + years,
          ) ? (
            <p className="rounded-[12px] border border-cc-danger-tint-border bg-cc-danger-tint px-4 py-3 text-[13px] text-cc-danger-ink">
              Some courses sit after year {years}, outside this plan. Move them,
              or check the programme in plan settings.
            </p>
          ) : null}
        </div>

        <aside
          ref={asideRef}
          aria-label="Progress and courses"
          className={cn(
            "scrollbar-subtle relative min-h-0 w-full flex-col gap-4 overflow-y-auto @7xl/shell:w-[380px] @7xl/shell:shrink-0",
            view === "side" ? "flex" : "hidden",
            "@7xl/shell:flex",
          )}
        >
          {selectedItem ? (
            <CourseDetail
              item={selectedItem}
              checks={checks.filter((c) => c.code === selectedItem.code)}
              options={options}
              signedIn={signedIn}
              onClose={() => setSelected(null)}
              onMove={(slot) => moveCourse(selectedItem.code, slot)}
              onFix={onFix}
              onDismiss={(c) =>
                selectedItem.slot &&
                c.code &&
                dismiss(`${c.code}:${c.rule}`, selectedItem.slot)
              }
              onLeaveOut={() => setLeftOut(selectedItem, true)}
              onRemove={() => removeCourse(selectedItem)}
              onResetSlot={() => removePlacement(selectedItem)}
              onMarkPassed={() => markPassed(selectedItem)}
              onMarkFailed={() => markFailed(selectedItem)}
              reviews={planStats.data[selectedItem.code]?.reviews}
              reviewsLoading={planStats.isPending}
              failed={
                !!takenRow(selectedItem.code) &&
                !(plan?.passedCodes.includes(selectedItem.code) ?? false)
              }
            />
          ) : null}
          {/* Progress and adding courses are two jobs; one tab each keeps the course list a click away instead of under every card. */}
          <div className="sticky top-0 z-10 -mb-2 hidden shrink-0 bg-cc-pg pb-2 @7xl/shell:block">
            <div
              role="tablist"
              aria-label="Side panel"
              className="flex gap-1 rounded-full bg-cc-pill p-1"
            >
              {(
                [
                  ["progress", "Progress", warnings.length > 0],
                  ["courses", "Add courses", (plan?.unplaced.length ?? 0) > 0],
                ] as const
              ).map(([id, label, dot]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={sideTab === id}
                  onClick={() => {
                    setSideTab(id);
                    if (id !== "courses") setAddTarget(null);
                  }}
                  className={cn(
                    "flex h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full text-[13px] transition-colors",
                    sideTab === id
                      ? "bg-cc-surface font-semibold text-cc-ink shadow-[0_1px_3px_rgba(20,30,45,0.12)]"
                      : "text-cc-muted hover:text-cc-ink",
                  )}
                >
                  {label}
                  {dot ? (
                    <>
                      <span
                        aria-hidden
                        className="size-1.5 rounded-full bg-cc-score-workload"
                      />
                      <span className="sr-only">
                        {id === "progress"
                          ? ", something to sort out"
                          : ", courses waiting"}
                      </span>
                    </>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
          {sideTab === "progress" ? (
            <>
              {setup.continuation ? (
                <CatchUpCard
                  open={setup.programme}
                  next={setup.continuation}
                  intake={setup.intake}
                  courses={catchUp}
                  onPlace={moveCourse}
                  onShow={(code) => setSelected(code)}
                />
              ) : null}
              {warnings.length ? (
                <section
                  aria-label="To sort out"
                  className="rounded-[16px] border border-cc-rule bg-cc-surface px-5 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-[14px] text-cc-ink">
                      To sort out
                    </h3>
                    <StatusPill tone="warn" icon={TriangleAlert}>
                      {warnings.length}
                    </StatusPill>
                  </div>
                  <ul className="mt-3 flex flex-col gap-1">
                    {warnings.slice(0, 12).map((c) => (
                      <li key={c.key}>
                        <button
                          type="button"
                          onClick={() => {
                            if (c.code) {
                              setSelected(c.code);
                              setView("side");
                            }
                          }}
                          className="flex w-full cursor-pointer items-start gap-2 rounded-[10px] px-2 py-1.5 text-left text-[12.5px] text-cc-ink leading-snug hover:bg-cc-pill"
                        >
                          <span className="mt-[2px] shrink-0 font-mono text-[11px] text-cc-brand">
                            {c.code ?? "Plan"}
                          </span>
                          <span className="min-w-0 flex-1">{c.message}</span>
                          <ChevronRight
                            aria-hidden
                            size={14}
                            className="mt-[2px] shrink-0 text-cc-muted"
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              <ProgressPanel
                sections={progress}
                onShow={(code) => setSelected(code)}
              />
            </>
          ) : (
            <>
              {plan ? (
                <CourseTray
                  unplaced={plan.unplaced}
                  electives={plan.electives}
                  trackOf={(t) =>
                    trackLabel(
                      t,
                      trackNamesIn(ownProgramme, nextProgramme, master),
                    )
                  }
                  titleOf={(code, fallback) =>
                    facts.courses[code]?.titleEng ?? fallback
                  }
                  describe={(code) => ({
                    level:
                      facts.courses[code]?.level ??
                      plan.template.get(code)?.level ??
                      null,
                    starts: offeredStartsOf(code, {
                      programme,
                      master,
                      currentRounds,
                      facts,
                    }),
                  })}
                  saved={savedRows}
                  leftOut={plan.leftOut}
                  options={options}
                  whereOf={whereOf}
                  onAdd={moveCourse}
                  onInclude={(code) => {
                    const it = allItems.find((i) => i.code === code);
                    if (it) setLeftOut(it, false);
                  }}
                  onRemoveOut={(code) => {
                    const it = allItems.find((i) => i.code === code);
                    if (it) removeCourse(it);
                  }}
                  onShow={(code) => setSelected(code)}
                  knownStats={planStats.data}
                  target={addTarget}
                  targetYear={
                    addTarget && startAy !== null
                      ? addTarget.ay - startAy + 1
                      : null
                  }
                  onClearTarget={() => setAddTarget(null)}
                />
              ) : null}
              <p className="px-1 text-[11.5px] text-cc-muted leading-snug">
                Periods come from your programme's schedule and each course's
                kth.se page for this academic year, else the catalogue's 2025/26
                rounds.
              </p>
            </>
          )}
        </aside>
      </div>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="scrollbar-subtle max-h-[90dvh] overflow-y-auto sm:max-w-[560px]">
          <DialogTitle>Plan settings</DialogTitle>
          <DialogDescription>
            Changing these keeps every course you placed where it is.
          </DialogDescription>
          <PlanSetup
            programmes={programmeList}
            initial={setup}
            onSave={saveAndClose}
            onCancel={() => setEditing(false)}
          />
          {/* Starting over sits apart from the settings, under a rule, in the danger colour. */}
          <div className="flex items-center justify-between gap-3 border-cc-rule border-t pt-4">
            <div className="min-w-0">
              <p className="font-medium text-[13px] text-cc-ink">Start over</p>
              <p className="text-[12px] text-cc-muted leading-snug">
                Back to the syllabus: its mandatory courses, each in its own
                period.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setConfirmReset(true);
              }}
              className="h-9 shrink-0 cursor-pointer rounded-full border border-cc-danger-tint-border px-3.5 text-[13px] text-cc-danger-ink hover:bg-cc-danger-tint"
            >
              Reset plan
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        request={
          confirmReset
            ? {
                eyebrow: "Study plan",
                title: "Reset your plan to the syllabus?",
                body: "Every course you moved goes back to its syllabus period, and the courses you added or left out are cleared. Your settings stay, and so do the periods of the courses you've passed.",
                cancelLabel: "Keep my plan",
                actionLabel: "Reset plan",
              }
            : null
        }
        onCancel={() => setConfirmReset(false)}
        onConfirm={resetPlan}
      />
    </div>
  );
}
