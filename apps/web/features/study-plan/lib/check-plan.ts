import type { PlanFactsResult, PrerequisiteGroup } from "@/types/programme";
import type { BuiltPlan, PeriodSpan, PlanItem } from "./build-plan";
import type { PlanState } from "./plan-storage";
import { type Period, type Slot, slotIndex, slotLabel } from "./slots";

/**
 * The plan's checks, in one pure pass.
 *
 * Severity follows how sure the data is, not how bad the outcome would be: a
 * warning is "the data says this is likely wrong", a note is "worth knowing".
 * Every warning on a course can be dismissed for the slot it fired in, and
 * comes back if the course moves, because a move changes the facts.
 */

export type CheckRule =
  | "offered"
  | "no-rounds"
  | "prerequisite"
  | "not-passed"
  | "overlap"
  | "load"
  | "mandatory";

export type CheckFix =
  | { kind: "move"; slot: Slot; label: string }
  | { kind: "remove"; label: string }
  | { kind: "include"; label: string }
  /** Puts another course — a prerequisite — in a period, adding it if the plan hasn't got it. */
  | { kind: "place"; code: string; slot: Slot; label: string };

export interface PlanCheck {
  key: string;
  code: string | null;
  rule: CheckRule;
  severity: "warning" | "note";
  message: string;
  evidence?: { text: string; source: string };
  fixes: CheckFix[];
  /** A prerequisite check's courses, any one of which would meet it. */
  needs?: string[];
}

/**
 * A Swedish course title's subject, as stems: "Numeriska metoder, grundkurs I"
 * and "Numeriska metoder, grundkurs" are one subject, "Envariabelanalys" and
 * "Flervariabelanalys" two. For "eller motsvarande", where the syllabus names
 * examples of a basic course rather than the only courses that will do.
 */
const NOT_SUBJECT = new Set([
  "och",
  "för",
  "med",
  "inom",
  "till",
  "del",
  "grundkurs",
  "fortsättningskurs",
  "kurs",
  "ii",
  "iii",
]);
function subjectStems(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-zåäö ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !NOT_SUBJECT.has(w))
    .map((w) => w.slice(0, 7));
}
export function sameSubject(a: string, b: string): boolean {
  const [x, y] = [new Set(subjectStems(a)), new Set(subjectStems(b))];
  if (!x.size || !y.size) return false;
  const [short, long] = x.size <= y.size ? [x, y] : [y, x];
  // One word says too little: "Programmeringsteknik" would cover "Tillämpad
  // programmering och datalogi", a different course. It must match one word exactly.
  if (short.size === 1)
    return long.size === 1 && [...short][0] === [...long][0];
  return [...short].every((w) => long.has(w));
}

/** Two first-cycle courses with the same Swedish title are one course under two codes. */
export function makeSameCourse(plan: BuiltPlan, facts: PlanFactsResult) {
  const title = (code: string) =>
    (
      facts.refs[code]?.titleSwe ??
      facts.courses[code]?.titleSwe ??
      plan.template.get(code)?.name ??
      ""
    )
      .trim()
      .toLowerCase();
  const level = (code: string) =>
    facts.refs[code]?.level ??
    facts.courses[code]?.level ??
    plan.template.get(code)?.level ??
    "B";
  return (a: string, b: string) =>
    a === b ||
    (level(a) === "B" &&
      level(b) === "B" &&
      title(a) !== "" &&
      title(a) === title(b));
}

/**
 * How a prerequisite has to stand when the course that needs it starts, as the
 * check reads it: done (the usual), begun (where the syllabus says a running
 * course counts as completed), or at most alongside ("aktivt deltagande").
 */
export type PrerequisiteTiming = "finished" | "started" | "together";

/**
 * The first period still to come that a course with these rounds can start in
 * and still be in time for a course starting at `beforeIdx`: where a missing
 * prerequisite can go. A round's end counts, not only its start — a P2–P3
 * round started in P2 is still running when a P3 course begins.
 */
export function firstPeriodBefore(
  spans: readonly PeriodSpan[],
  now: Slot,
  beforeIdx: number,
  timing: PrerequisiteTiming = "finished",
): Slot | null {
  const nowIdx = slotIndex(now);
  for (let ay = now.ay; ay <= Math.floor(beforeIdx / 10); ay++)
    for (const p of [1, 2, 3, 4] as const) {
      const startIdx = slotIndex({ ay, p });
      if (startIdx <= nowIdx) continue;
      const fits = spans.some((s) => {
        if (s.start !== p) return false;
        if (timing === "together") return startIdx <= beforeIdx;
        if (timing === "started") return startIdx < beforeIdx;
        return slotIndex({ ay, p: s.end }) < beforeIdx;
      });
      if (fits) return { ay, p };
    }
  return null;
}

/** How a prerequisite group stands for one course: met, and how, or not, and why. */
type GroupStatus =
  | {
      met: true;
      via: string;
      equivalent: boolean;
      /** Met because `via`, a course already taken, asked for no less. */
      settled?: boolean;
    }
  | { met: false; blockedBy: string | null };

function groupStatus(
  item: PlanItem,
  group: PrerequisiteGroup,
  registeredCounts: boolean,
  plan: BuiltPlan,
  takenCodes: string[],
  same: (a: string, b: string) => boolean,
  /** A course "eller motsvarande" lets stand in for one of the group's. */
  equivalent: (code: string) => boolean,
  /** Courses that can't be taken as planned, so they meet nothing after them. */
  blocked: ReadonlySet<string>,
): GroupStatus {
  const named = (code: string) => group.codes.some((m) => same(code, m));
  const inTime = (x: PlanItem) =>
    x.code !== item.code &&
    x.status !== "not-passed" &&
    (group.strength === "participating"
      ? x.startIdx <= item.startIdx
      : registeredCounts
        ? x.startIdx < item.startIdx
        : x.endIdx < item.startIdx);
  const earlier = plan.items.filter(inTime);
  // A passed course first, then a planned one, a named course before an equivalent.
  for (const [test, equivalentTo] of [
    [named, false],
    [equivalent, true],
  ] as const) {
    const passed = takenCodes.find(test);
    if (passed) return { met: true, via: passed, equivalent: equivalentTo };
    const planned = earlier.find((x) => test(x.code) && !blocked.has(x.code));
    if (planned)
      return { met: true, via: planned.code, equivalent: equivalentTo };
  }
  const stuck = earlier.find(
    (x) => (named(x.code) || equivalent(x.code)) && blocked.has(x.code),
  );
  return { met: false, blockedBy: stuck?.code ?? null };
}

const periodsText = (ps: Period[]) =>
  ps.map((p) => (p === 5 ? "summer" : `P${p}`)).join(" or ");

export function checkPlan(
  plan: BuiltPlan,
  facts: PlanFactsResult,
  state: PlanState,
  now: Slot,
  takenCodes: string[],
  /**
   * The plan starts from a prior degree (a master's programme on its own), so a
   * prerequisite any basic-level course could meet is taken as met: the degree
   * the student was admitted with covers it.
   */
  entryDegree = false,
  /** When a course's rounds start and end, for suggesting where a missing prerequisite fits. */
  spansOf: (code: string) => readonly PeriodSpan[] = () => [],
): PlanCheck[] {
  const out: PlanCheck[] = [];
  const levelOf = (code: string) =>
    facts.refs[code]?.level ?? facts.courses[code]?.level ?? "B";
  const nowIdx = slotIndex(now);
  const same = makeSameCourse(plan, facts);
  const add = (c: PlanCheck) => {
    const dismissed = c.code
      ? state.dismissed[`${c.code}:${c.rule}`]
      : undefined;
    const item = c.code ? plan.items.find((i) => i.code === c.code) : undefined;
    if (
      dismissed &&
      item?.slot &&
      slotIndex(dismissed) === slotIndex(item.slot)
    )
      return;
    out.push(c);
  };

  for (const it of plan.items) {
    if (!it.slot) continue;
    // Offered: only periods still to come — a course under way is being given, whatever the schedule said.
    if (it.status === "planned" && it.startIdx > nowIdx) {
      if (it.roundSource === "none")
        add({
          key: `${it.code}:no-rounds`,
          code: it.code,
          rule: "no-rounds",
          severity: "note",
          message: `No round of ${it.code} is listed for 2025/26 or this year. It may run every other year, or be retired.`,
          fixes: [],
        });
      else if (it.offPeriod)
        add({
          key: `${it.code}:offered`,
          code: it.code,
          rule: "offered",
          severity: "warning",
          message: `${it.code} starts in ${periodsText(it.offeredStarts)}, not ${it.slot.p === 5 ? "summer" : `P${it.slot.p}`}.`,
          evidence: {
            text: `Starts in ${periodsText(it.offeredStarts)}`,
            source:
              "Your programme's schedule for this academic year on kth.se, and the catalogue's 2025/26 rounds",
          },
          fixes: it.offeredStarts.map((p) => ({
            kind: "move" as const,
            slot: { ay: it.slot?.ay ?? 0, p },
            label: `Move to ${p === 5 ? "summer" : `P${p}`}`,
          })),
        });
    }
    // A course that wasn't passed already says so in its own pill, with "Mark as
    // passed" beside it. Only a mandatory one needs more: it still has to be
    // taken, so the check points at the next round it can be retaken in.
    if (it.status === "not-passed" && it.mandatory) {
      const retake = nextRound(it.offeredStarts, nowIdx);
      add({
        key: `${it.code}:not-passed`,
        code: it.code,
        rule: "not-passed",
        severity: "warning",
        message: `${it.code} is mandatory and not passed yet. Plan it again in a period it's given.`,
        fixes: retake
          ? [
              {
                kind: "move",
                slot: retake,
                label: `Move to ${slotLabel(retake)}`,
              },
            ]
          : [],
      });
    }
  }

  // ---- Prerequisites. ----
  const titleOf = (code: string) =>
    facts.refs[code]?.titleSwe ??
    facts.courses[code]?.titleSwe ??
    plan.template.get(code)?.name ??
    "";
  /**
   * "SF1918, SF1922 eller motsvarande": a first-cycle course of the same
   * department and subject stands in. Without it a student whose programme
   * gave the subject under another code was flagged as blocked for good.
   */
  const equivalentFor = (g: PrerequisiteGroup) => (code: string) =>
    /motsvarande|equivalent/i.test(g.text) &&
    levelOf(code) === "B" &&
    g.codes.some(
      (m) =>
        m !== code &&
        m.slice(0, 2) === code.slice(0, 2) &&
        sameSubject(titleOf(m), titleOf(code)),
    );
  // Only a course still to come is checked. One that has started — passed, under
  // way, or in the past of a plan without a transcript — had its eligibility settled
  // when it began: there is nothing left to be eligible for, and no period to fix.
  const checked = plan.items.filter(
    (it) =>
      it.slot &&
      it.status !== "passed" &&
      it.startIdx > nowIdx &&
      facts.courses[it.code],
  );
  /**
   * What a course already taken asked for was met, one way or another: KTH
   * admits nobody to a course without it, and a transition plan may have met it
   * with something we can't see. A later course that asks for no more than that
   * — every course of the earlier group is one of its own — is met as well.
   */
  const settledGroups = [...plan.items, ...plan.unplaced]
    .filter(
      (i) =>
        i.status === "passed" ||
        (i.startIdx <= nowIdx && i.status !== "not-passed"),
    )
    .flatMap((i) =>
      (facts.courses[i.code]?.prerequisites ?? [])
        .filter((g) => !g.open && !g.unresolvable && g.codes.length)
        .map((g) => ({ by: i.code, codes: g.codes })),
    );
  const settledBy = (g: PrerequisiteGroup) =>
    settledGroups.find((s) =>
      s.codes.every((c) => g.codes.some((m) => same(c, m))),
    )?.by ?? null;
  const groupsOf = (it: PlanItem) =>
    (facts.courses[it.code]?.prerequisites ?? []).filter(
      (g) =>
        !g.unresolvable &&
        !(entryDegree && g.codes.some((c) => levelOf(c) !== "A")),
    );
  const statusOf = (
    it: PlanItem,
    g: PrerequisiteGroup,
    blocked: ReadonlySet<string>,
  ): GroupStatus => {
    const st = groupStatus(
      it,
      g,
      facts.courses[it.code]?.registeredCounts ?? false,
      plan,
      takenCodes,
      same,
      equivalentFor(g),
      blocked,
    );
    if (st.met) return st;
    const by = settledBy(g);
    return by ? { met: true, via: by, equivalent: false, settled: true } : st;
  };
  // A course that can't be taken as planned meets nothing after it, so the block
  // runs down the chain: no SF1922, then no SF2940, then none of the track after it.
  const blocked = new Set<string>();
  for (let changed = true, round = 0; changed && round < 12; round++) {
    changed = false;
    for (const it of checked)
      if (
        !blocked.has(it.code) &&
        groupsOf(it).some((g) => !g.open && !statusOf(it, g, blocked).met)
      ) {
        blocked.add(it.code);
        changed = true;
      }
  }
  const fitBefore = (
    code: string,
    beforeIdx: number,
    timing: PrerequisiteTiming,
  ) => firstPeriodBefore(spansOf(code), now, beforeIdx, timing);

  for (const it of checked) {
    groupsOf(it).forEach((g, gi) => {
      const st = statusOf(it, g, blocked);
      const names =
        g.codes.slice(0, 3).join(", ") +
        (g.codes.length > 3 ? ` (or ${g.codes.length - 3} more)` : "");
      const evidence = {
        text: `The syllabus asks for ${g.codes.length > 1 ? "one of " : ""}${g.codes.slice(0, 8).join(", ")}${g.codes.length > 8 ? " or similar" : ""}${g.strength === "participating" ? ", taken at the same time at the latest" : ", completed first"}.`,
        source: `${it.code}'s eligibility on kth.se`,
      };
      const base = {
        key: `${it.code}:prerequisite:${gi}`,
        code: it.code,
        rule: "prerequisite" as const,
        evidence,
        needs: g.codes,
      };
      if (st.met) {
        if (st.settled)
          add({
            ...base,
            severity: "note",
            message: `${it.code} asks for ${names}. ${st.via}, which you've taken, asked for the same, so it counts as met.`,
            fixes: [],
          });
        else if (st.equivalent)
          add({
            ...base,
            severity: "note",
            message: `${it.code} asks for ${names} or equivalent, and ${st.via} should count as equivalent. The examiner decides.`,
            fixes: [],
          });
        return;
      }
      if (g.open) {
        add({
          ...base,
          severity: "note",
          message: `${it.code} asks for ${names}, or something we can't check. Read the requirement.`,
          fixes: [],
        });
        return;
      }
      if (st.blockedBy) {
        add({
          ...base,
          severity: "warning",
          message: `${it.code} needs ${st.blockedBy} first, but ${st.blockedBy} can't be taken as planned either: its own prerequisites aren't met.`,
          fixes: [],
        });
        return;
      }
      const later = plan.items.find(
        (x) =>
          g.codes.some((m) => same(x.code, m)) && x.startIdx >= it.startIdx,
      );
      // Where a course that meets it fits in time: the one already planned too late,
      // else a syllabus course of the group, else the first that is given early enough.
      const order = later
        ? [later.code]
        : [
            ...g.codes.filter((c) => plan.template.has(c)),
            ...g.codes.filter((c) => !plan.template.has(c)),
          ];
      let fix: CheckFix | null = null;
      for (const c of order) {
        const slot = fitBefore(
          c,
          it.startIdx,
          g.strength === "participating"
            ? "together"
            : facts.courses[it.code]?.registeredCounts
              ? "started"
              : "finished",
        );
        if (slot) {
          fix = {
            kind: "place",
            code: c,
            slot,
            label: `${later ? "Move" : "Add"} ${c} to ${slotLabel(slot)}`,
          };
          break;
        }
      }
      add({
        ...base,
        severity: "warning",
        message: later
          ? `${it.code} needs ${later.code} first, and it comes ${later.startIdx === it.startIdx ? "in the same period" : "later"} in your plan.`
          : `${it.code} needs one of ${names}, and nothing earlier in your plan covers it.`,
        fixes: fix ? [fix] : [],
      });
    });
  }

  // Overlaps: at most one of each "Endast en av" set counts toward the degree.
  for (const set of plan.overlaps) {
    const inPlan = plan.items
      .filter((i) => i.counts && set.includes(i.code))
      .sort((a, b) => a.startIdx - b.startIdx);
    for (const x of inPlan.slice(1))
      add({
        key: `${x.code}:overlap`,
        code: x.code,
        rule: "overlap",
        severity: "warning",
        message: `${x.code} and ${inPlan[0].code} can't both count toward your degree.`,
        evidence: {
          text: `Only one of ${set.join(", ")} can count toward the degree.`,
          source: "your programme's syllabus",
        },
        fixes: x.taken ? [] : [{ kind: "remove", label: `Remove ${x.code}` }],
      });
  }

  // Mandatory courses the student has left out.
  for (const m of plan.mandatory) {
    if (!state.leftOut.includes(m.code)) continue;
    add({
      key: `${m.code}:mandatory`,
      code: null,
      rule: "mandatory",
      severity: "warning",
      message: `${m.code} ${facts.courses[m.code]?.titleEng ?? m.name} is mandatory in year ${m.studyYear} and isn't in your plan.`,
      fixes: [],
    });
  }

  // Load: more than 15 hp in a period is over full time; more than 22.5 is a lot.
  const load = periodLoad(plan.items);
  for (const [idx, credits] of load) {
    if (idx < nowIdx || idx % 10 === 5) continue;
    if (credits > 22.55)
      add({
        key: `period:${idx}:load`,
        code: null,
        rule: "load",
        severity: "warning",
        message: `${slotLabel({ ay: Math.floor(idx / 10), p: (idx % 10) as Period })}: ${credits.toFixed(1)} hp. Full time is 15 hp a period.`,
        fixes: [],
      });
  }
  return out;
}

/** The first period after now that one of the course's rounds starts in. */
function nextRound(starts: readonly Period[], nowIdx: number): Slot | null {
  const usable = starts.filter((p) => p !== 5);
  if (!usable.length) return null;
  for (let ay = Math.floor(nowIdx / 10); ay < Math.floor(nowIdx / 10) + 3; ay++)
    for (const p of [...usable].sort())
      if (ay * 10 + p > nowIdx) return { ay, p };
  return null;
}

/** Credits per period, using each round's own split. */
export function periodLoad(items: readonly PlanItem[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const it of items) {
    if (!it.counts) continue;
    for (const s of it.segments)
      m.set(slotIndex(s.slot), (m.get(slotIndex(s.slot)) ?? 0) + s.credits);
  }
  return m;
}
