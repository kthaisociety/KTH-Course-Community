"use client";

import { MAX_REVIEW_SCORE, MIN_REVIEW_SCORE } from "@/types";

/**
 * The controls a 1–10 score is drawn and answered with, in one place.
 *
 * ## Why here, and why one copy
 *
 * `ScoreSlider` and `ValuePill` existed twice — `reviewer-card.tsx` and
 * `features/workspace/components/review-draft-panel.tsx` — near-verbatim, in
 * spite of `pane-parts.tsx` existing to prevent exactly that and saying so:
 * *"Keeping either in both files is how the two drift."* They had drifted, in
 * three ways, and the third was a real defect:
 *
 * 1. the panel hardcoded `` `${value} of 10` `` in `aria-valuetext` where the
 *    card read `MAX_REVIEW_SCORE` — divergence on the raw score display, which
 *    is the one thing the score decision was most specific about;
 * 2. `aria-hidden` versus `aria-hidden="true"`, which is nothing;
 * 3. **the panel filled the track with `var(--cc-warn-btn)` and the card with
 *    `--cc-btn`.** `Workspace Pane.dc.html` and `Taken Courses.dc.html` both
 *    draw it `background:var(--btn)`, so the card was right. In light the two
 *    tokens happen to hold the same `#1751a6` and nothing showed; in dark
 *    `--cc-warn-btn` is `#dfa53c`, so the pane drew an amber slider where the
 *    design says blue. A duplicate that is only wrong in one theme is why this
 *    kind of copy survives review.
 *
 * It lives in `features/reviews` and not in `pane-parts.tsx` because the score
 * belongs to reviews, and because the dependency only runs one way:
 * `review-draft-panel.tsx` already imports `@/features/reviews`, so the reverse
 * import would close a cycle.
 */

/** The applied half of a theory/applied track. See `--cc-applied` in `globals.css`. */
export const APPLIED_FILL = "var(--cc-applied)";

/** An unanswered track is drawn in the theme's strong hairline, not a fill. */
export const UNSET_FILL = "var(--cc-rule3)";

/** The small tinted chip that carries a value, or "Not set". */
export function ValuePill({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex-none rounded-full bg-cc-pill px-[9px] py-0.5 font-semibold text-[12px] text-cc-brand tabular-nums">
      {children}
    </span>
  );
}

/**
 * A 1–10 score, on the scale the database stores.
 *
 * The visible track is ours so that an unanswered score reads as empty rather
 * than as 1 — the difference between "not answered" and "the lowest answer" is
 * the whole point of `workloadScore` being `null`. The range input on top of it
 * is what a keyboard and a screen reader drive, and `onPointerUp` commits as
 * well as `onChange` so clicking the value the input already holds still counts
 * as answering.
 */
export function ScoreSlider({
  label,
  value,
  minLabel,
  maxLabel,
  onChange,
}: {
  label: string;
  value: number | null;
  minLabel: string;
  maxLabel: string;
  onChange: (next: number) => void;
}) {
  const percent = value === null ? 0 : (value / MAX_REVIEW_SCORE) * 100;
  return (
    <div>
      <div className="mb-[9px] flex items-baseline justify-between gap-2.5">
        <span className="font-semibold text-[14.5px]">{label}</span>
        <ValuePill>
          {value === null ? "Not set" : `${value} / ${MAX_REVIEW_SCORE}`}
        </ValuePill>
      </div>
      <div className="relative flex h-[22px] items-center">
        <div className="h-2 w-full overflow-hidden rounded-[4px] bg-cc-pill">
          <div className="h-full bg-cc-btn" style={{ width: `${percent}%` }} />
        </div>
        {value !== null && (
          <div
            aria-hidden="true"
            className="-ml-2.5 absolute size-5 rounded-full border-2 border-cc-brand bg-cc-surface"
            style={{ left: `${percent}%` }}
          />
        )}
        <input
          type="range"
          min={MIN_REVIEW_SCORE}
          max={MAX_REVIEW_SCORE}
          step={1}
          value={value ?? MIN_REVIEW_SCORE}
          aria-label={label}
          aria-valuetext={
            value === null ? "Not set" : `${value} of ${MAX_REVIEW_SCORE}`
          }
          onChange={(event) => onChange(Number(event.target.value))}
          onPointerUp={(event) => onChange(Number(event.currentTarget.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>
      <div className="mt-1 flex justify-between text-[11.5px] text-cc-muted">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}
