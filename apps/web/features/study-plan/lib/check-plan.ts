import type { PlanFactsResult, PrerequisiteGroup } from "@/types/programme";
import type { BuiltPlan, PlanItem } from "./build-plan";
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
  | { kind: "mark-passed"; label: string }
  | { kind: "remove"; label: string }
  | { kind: "include"; label: string };

export interface PlanCheck {
  key: string;
  code: string | null;
  rule: CheckRule;
  severity: "warning" | "note";
  message: string;
  evidence?: { text: string; source: string };
  fixes: CheckFix[];
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

function groupMet(
  item: PlanItem,
  group: PrerequisiteGroup,
  registeredCounts: boolean,
  plan: BuiltPlan,
  takenCodes: string[],
  same: (a: string, b: string) => boolean,
) {
  for (const member of group.codes) {
    if (takenCodes.some((t) => same(t, member))) return true;
    const hit = plan.items.find(
      (x) =>
        x.code !== item.code &&
        same(x.code, member) &&
        x.status !== "not-passed" &&
        (() => {
          if (group.strength === "participating")
            return x.startIdx <= item.startIdx;
          if (registeredCounts) return x.startIdx < item.startIdx;
          return x.endIdx < item.startIdx;
        })(),
    );
    if (hit) return true;
  }
  return false;
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
    if (it.status === "not-passed")
      add({
        key: `${it.code}:not-passed`,
        code: it.code,
        rule: "not-passed",
        severity: it.mandatory ? "warning" : "note",
        message: `${slotLabel(it.segments[it.segments.length - 1].slot)} has ended and ${it.code} isn't in your taken courses${it.mandatory ? ". It's mandatory, so it still has to be passed" : ""}.`,
        fixes: [
          { kind: "mark-passed", label: "I passed it" },
          ...(it.mandatory
            ? []
            : [{ kind: "remove" as const, label: "Remove" }]),
        ],
      });
    // Prerequisites are never checked for a passed course: there is nothing left to be eligible for.
    if (it.status === "passed") continue;
    const f = facts.courses[it.code];
    if (!f) continue;
    f.prerequisites.forEach((g, gi) => {
      if (g.unresolvable) return;
      if (entryDegree && g.codes.some((c) => levelOf(c) !== "A")) return;
      if (groupMet(it, g, f.registeredCounts, plan, takenCodes, same)) return;
      const names =
        g.codes.slice(0, 3).join(", ") +
        (g.codes.length > 3 ? ` (or ${g.codes.length - 3} more)` : "");
      const later = plan.items.find(
        (x) =>
          g.codes.some((m) => same(x.code, m)) && x.startIdx >= it.startIdx,
      );
      add({
        key: `${it.code}:prerequisite:${gi}`,
        code: it.code,
        rule: "prerequisite",
        severity: g.open ? "note" : "warning",
        message: g.open
          ? `${it.code} asks for ${names}, or something we can't check. Read the requirement.`
          : later
            ? `${it.code} needs ${later.code} first, and it comes ${later.startIdx === it.startIdx ? "in the same period" : "later"} in your plan.`
            : `${it.code} needs one of ${names}, and nothing earlier in your plan covers it.`,
        evidence: {
          text: `The syllabus asks for ${g.codes.length > 1 ? "one of " : ""}${g.codes.slice(0, 8).join(", ")}${g.codes.length > 8 ? " or similar" : ""}${g.strength === "participating" ? ", taken at the same time at the latest" : ", completed first"}.`,
          source: `${it.code}'s eligibility on kth.se`,
        },
        fixes: [],
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
