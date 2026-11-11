"use client";

import { Download, Settings2, Upload } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { authHref, useSessionData } from "@/features/auth";
import { useMarkCourseTaken, useTakenCourses } from "@/features/courses";
import { useGuestSaves } from "@/features/saved";
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
import { buildPlan, type PlanItem, type TakenRow } from "../lib/build-plan";
import {
  type CheckFix,
  checkPlan,
  type PlanCheck,
  periodLoad,
} from "../lib/check-plan";
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
import { CourseDetail } from "./course-detail";
import { CourseTray, type SlotOption } from "./course-tray";
import { PlanSetup } from "./plan-setup";
import { ProgressPanel } from "./progress-panel";
import { YearRow } from "./year-row";

const NO_FACTS: PlanFactsResult = { courses: {}, refs: {} };
const NO_TAKEN: TakenRow[] = [];
const NO_ROUNDS: Record<string, CurrentRound[]> = {};

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
  const { state, saveSetup, place, leaveOut, dismiss, exportPlan, importPlan } =
    usePlanStore(owner);
  const setup = state.setup;
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"plan" | "side">("plan");
  const fileRef = useRef<HTMLInputElement>(null);
  const now = useMemo(() => slotOf(new Date()), []);

  const programmes = useProgrammes();
  const programme = useProgramme(setup?.programme ?? null).data ?? null;
  const isCiving = programme?.summary.type === "CING";
  const master =
    useProgramme(isCiving ? (setup?.master ?? null) : null).data ?? null;
  const takenQuery = useTakenCourses(signedIn);
  const taken: TakenRow[] = takenQuery.data ?? NO_TAKEN;
  const accountSaved = useSavedCodes(signedIn).data;
  const guestSaved = useGuestSaves();
  const savedCodes = signedIn ? (accountSaved ?? []) : guestSaved;
  const markTaken = useMarkCourseTaken();

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
    return [
      ...new Set(
        [...plan.items, ...plan.unplaced, ...plan.leftOut]
          .map((i) => i.code)
          .concat(
            savedCodes,
            plan.electives.map((e) => e.code),
            required,
          ),
      ),
    ].sort();
  }, [plan, savedCodes, masterReq, setup, programme]);
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

  const takenCodes = useMemo(() => taken.map((t) => t.courseCode), [taken]);
  const checks = useMemo(
    () =>
      plan
        ? checkPlan(
            plan,
            facts,
            state,
            now,
            takenCodes,
            programme?.summary.type === "TMAST",
          )
        : [],
    [plan, facts, state, now, takenCodes, programme],
  );
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
  const inPlan = new Set(allItems.map((i) => i.code));

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
    undoable(`${code} moved to ${slotLabel(slot)}.`, () => place(code, before));
  };
  const leftOutHas = (code: string) => state.leftOut.includes(code);
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
  const markPassed = (item: PlanItem) => {
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
    else if (fix.kind === "mark-passed") markPassed(item);
    else if (fix.kind === "remove") removePlacement(item);
    else if (fix.kind === "include") setLeftOut(item, false);
  };

  const savedRows = useMemo(
    () =>
      savedCodes
        .filter((c) => !inPlan.has(c))
        .map((c) => ({
          code: c,
          title: facts.courses[c]?.titleEng ?? c,
          credits: facts.courses[c]?.credits ?? null,
        })),
    [savedCodes, inPlan, facts],
  );

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
    a.download = "study-plan.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  const onImport = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as {
        kind?: string;
        plan?: Record<string, unknown>;
      };
      if (parsed.kind !== "kth-cc-study-plan" || !parsed.plan)
        throw new Error("not a plan");
      importPlan(parsed.plan);
      toast("Plan imported.");
    } catch {
      toast("That file isn't a study plan exported from here.");
    }
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
          {!signedIn && !session.isPending ? (
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
            Your plan is saved in this browser. Export it from the plan to keep
            a copy.
          </p>
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
          <p className="mt-0.5 truncate text-[13px] text-cc-muted">
            {summary ? `${summary.code} · ${summary.nameEn}` : setup.programme}{" "}
            · started {intakeLabel(setup.intake)}
            {setup.master
              ? ` · ${isCiving ? "master's" : "next"}: ${setup.master}`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[10px] border border-cc-rule2 px-3 text-[13px] text-cc-ink hover:bg-cc-pill"
          >
            <Settings2 aria-hidden size={15} /> Plan settings
          </button>
          <button
            type="button"
            onClick={onExport}
            aria-label="Export plan"
            title="Export plan"
            className="flex size-9 cursor-pointer items-center justify-center rounded-[10px] border border-cc-rule2 text-cc-ink hover:bg-cc-pill"
          >
            <Download aria-hidden size={15} />
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Import plan"
            title="Import plan"
            className="flex size-9 cursor-pointer items-center justify-center rounded-[10px] border border-cc-rule2 text-cc-ink hover:bg-cc-pill"
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
          className="flex w-full gap-1 rounded-[10px] bg-cc-pill p-1 @5xl/shell:hidden"
        >
          {(["plan", "side"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn(
                "h-8 flex-1 cursor-pointer rounded-[8px] text-[13px]",
                view === v
                  ? "bg-cc-surface font-medium text-cc-ink"
                  : "text-cc-muted",
              )}
            >
              {v === "plan"
                ? "Plan"
                : `Progress & courses${warnings.length ? ` · ${warnings.length}` : ""}`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-6 px-5 pb-5 @3xl/shell:px-7">
        <div
          className={cn(
            "scrollbar-subtle min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto pr-1",
            view === "plan" ? "flex" : "hidden",
            "@5xl/shell:flex",
          )}
        >
          {!signedIn && !session.isPending ? (
            <div className="rounded-[12px] border border-cc-rule bg-cc-info px-4 py-3 text-[13px] text-cc-ink">
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
            <div className="rounded-[12px] border border-cc-warn-border bg-cc-warn px-4 py-3 text-[13px] text-cc-ink">
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
              onSelect={(code) =>
                setSelected((s) => (s === code ? null : code))
              }
              onNudge={nudge}
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
          aria-label="Progress and courses"
          className={cn(
            "scrollbar-subtle min-h-0 w-full flex-col gap-4 overflow-y-auto @5xl/shell:w-[380px] @5xl/shell:shrink-0",
            view === "side" ? "flex" : "hidden",
            "@5xl/shell:flex",
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
              onRemove={() => removePlacement(selectedItem)}
              onResetSlot={() => removePlacement(selectedItem)}
              onMarkPassed={() => markPassed(selectedItem)}
            />
          ) : null}
          {warnings.length ? (
            <section
              aria-label="To sort out"
              className="rounded-[14px] border border-cc-warn-border bg-cc-warn px-5 py-4"
            >
              <h3 className="font-semibold text-[14px] text-cc-ink">
                To sort out · {warnings.length}
              </h3>
              <ul className="mt-2 flex flex-col gap-1.5">
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
                      className="w-full cursor-pointer text-left text-[12.5px] text-cc-ink leading-snug hover:underline"
                    >
                      {c.message}
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
          {plan ? (
            <CourseTray
              unplaced={plan.unplaced}
              electives={plan.electives}
              titleOf={(code, fallback) =>
                facts.courses[code]?.titleEng ?? fallback
              }
              saved={savedRows}
              leftOut={plan.leftOut}
              options={options}
              inPlan={inPlan}
              onAdd={moveCourse}
              onInclude={(code) => {
                const it = allItems.find((i) => i.code === code);
                if (it) setLeftOut(it, false);
              }}
            />
          ) : null}
          <p className="px-1 text-[11.5px] text-cc-muted leading-snug">
            Periods for this academic year come from your programme's own
            schedule on kth.se; other courses use the catalogue's 2025/26
            rounds. Your plan is saved in this browser.
          </p>
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
