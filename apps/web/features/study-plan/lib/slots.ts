/**
 * Time in a study plan.
 *
 * A slot is absolute — an academic year (the autumn it starts in) and a period
 * — never a study year, so changing the start term relabels rows without
 * moving a course. Periods are KTH's: P1–P2 in the
 * autumn term (HT), P3–P4 in the spring term (VT), and P5 the summer after.
 */

export type Period = 1 | 2 | 3 | 4 | 5;

export interface Slot {
  /** The academic year, by the autumn it starts in: 2026 is 2026/27. */
  ay: number;
  p: Period;
}

/** A sortable number for a slot: 20262 is P2 of 2026/27. */
export const slotIndex = (s: Slot) => s.ay * 10 + s.p;
export const fromIndex = (i: number): Slot => ({
  ay: Math.floor(i / 10),
  p: (i % 10) as Period,
});

/** The slot after `s`, skipping summer unless asked for. */
export function nextSlot(s: Slot, withSummer = false): Slot {
  if (s.p === 4)
    return withSummer ? { ay: s.ay, p: 5 } : { ay: s.ay + 1, p: 1 };
  if (s.p === 5) return { ay: s.ay + 1, p: 1 };
  return { ay: s.ay, p: (s.p + 1) as Period };
}

/**
 * Where today falls. KTH's periods start late August, late October, mid
 * January and mid March; summer runs from June. Close enough for "now".
 */
export function slotOf(date: Date): Slot {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const y = date.getFullYear();
  if (m > 8 || (m === 8 && d >= 20))
    return { ay: y, p: m < 10 || (m === 10 && d < 27) ? 1 : 2 };
  if (m === 1 && d < 16) return { ay: y - 1, p: 2 };
  if (m < 3 || (m === 3 && d < 18)) return { ay: y - 1, p: 3 };
  if (m < 6) return { ay: y - 1, p: 4 };
  return { ay: y - 1, p: 5 };
}

export const ayLabel = (ay: number) => `${ay}/${String(ay + 1).slice(2)}`;
export const termLabel = (s: Slot) =>
  s.p <= 2 ? `HT ${s.ay}` : s.p === 5 ? `Summer ${s.ay + 1}` : `VT ${s.ay + 1}`;
export const slotLabel = (s: Slot) =>
  s.p === 5 ? termLabel(s) : `${termLabel(s)} P${s.p}`;

/** "20242" → { start: 2024 } as HT 2024; "20251" → spring 2025, which starts in academic year 2024/25. */
export function intakeStart(term: string): { ay: number; p: Period } {
  const year = Number(term.slice(0, 4));
  return term.endsWith("1") ? { ay: year - 1, p: 3 } : { ay: year, p: 1 };
}

export const intakeLabel = (term: string) =>
  term.endsWith("1") ? `VT ${term.slice(0, 4)}` : `HT ${term.slice(0, 4)}`;

/** Study year 1 is the academic year the intake starts in. */
export const studyYearOf = (ay: number, startAy: number) => ay - startAy + 1;
