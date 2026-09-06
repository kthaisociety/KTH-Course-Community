"use client";

import { Lock } from "lucide-react";
import {
  DEFAULT_NODE_COLOR_VAR,
  NODE_COLOR_VARS,
  nodeColorVar,
} from "@/features/landing";
import type { NodePersonalization } from "../api/queries";
import {
  type NodeAppearanceChoice,
  type PersonalizationAxisKey,
  type PersonalizationTierRow,
  personalizationTierRows,
  UNCONFIGURED,
} from "../lib/personalization-tiers";

type Props = {
  /**
   * Both tier numbers and the stored appearance, from `graph.personalization`.
   * `undefined` while the read is in flight.
   *
   * Both numbers are needed and neither substitutes for the other. The
   * **effective** tier decides what may be edited; the **earned** tier is used
   * for one thing only — telling a dormant axis from a locked one — and is never
   * phrased as something lost, because the column never lowers.
   */
  personalization: NodePersonalization | undefined;
  /** The tier could not be read at all — distinct from an effective tier of 0. */
  isUnavailable: boolean;
  /** Write one or more axes. The parent owns the mutation. */
  onChoose: (choice: NodeAppearanceChoice) => void;
  /** A write is in flight; every option is disabled until it answers. */
  isSaving: boolean;
  /** The last write failed. The server is the authority, so nothing was painted. */
  saveFailed: boolean;
};

/**
 * How far the viewer has unlocked their **node profile** — a node's appearance,
 * stored separately from graph topology — and the surface where they choose it.
 * This is the tab the artboard labels "My dot" (`docs/design_ref/2026-09-06/
 * Course Community - My Page.dc.html`, its `isDot` branch); `CONTEXT.md`
 * licenses "dot" for the **Find your dot** flow's copy alone, so the label stays
 * and the identifiers say what the glossary says.
 *
 * **The palette used to be shown rather than offered, and that is closed.** It
 * was inert for two honest reasons: no procedure wrote `users_node_profiles`,
 * and `node_style` and `node_signal_style` were Postgres enums with one value
 * each, so unlocking tier 2 or 3 unlocked a set of one. Both are fixed —
 * `graph.setAppearance` is the writer and migration 0015 adds the values — so
 * these are buttons now, and clicking one changes what the landing hero draws.
 *
 * **The gate is not here.** Locking an option in this component is presentation:
 * `setNodeAppearance` re-derives the effective tier and refuses an axis it does
 * not reach, because a signed-in caller can post whatever they like to a tRPC
 * procedure. The two run the same `PERSONALIZATION_AXES` table, which is why
 * what is offered and what is accepted cannot drift apart.
 *
 * The colours are drawn from `--cc-node-*`, mapped from the stored **names**
 * through the same table the landing page's canvas uses. The server stores a
 * name and never a hex; `cc-store.js` inverts that — its `NODE_COLORS` is five
 * hex strings — and is wrong about the shape.
 */
export function NodeProfile({
  personalization,
  isUnavailable,
  onChoose,
  isSaving,
  saveFailed,
}: Props) {
  const rows = personalizationTierRows(
    personalization?.earnedTier ?? 0,
    personalization?.effectiveTier ?? 0,
  );

  return (
    <div className="flex flex-col gap-3.5 px-7 pt-[22px] @max-[440px]:px-[14px] @max-[440px]:pt-3">
      <section className="rounded-xl border border-cc-rule bg-cc-surface px-[17px] pt-4 pb-[15px]">
        <h2 className="m-0 font-semibold text-[15.5px]">
          Your node on the landing page
        </h2>
        <p className="m-0 mt-[5px] text-[13px] text-cc-muted leading-[1.5]">
          Review courses to unlock how your dot looks in the network. Go quiet
          for a while and it settles back to default.
        </p>
      </section>

      {saveFailed ? (
        <output className="block rounded-xl border border-cc-rule bg-cc-surface px-[17px] py-4 text-[12.5px] text-cc-dim">
          That choice could not be saved. Your node still looks the way it did —
          nothing was changed.
        </output>
      ) : null}

      {isUnavailable ? (
        <output className="block rounded-xl border border-cc-rule bg-cc-surface px-[17px] py-4 text-[12.5px] text-cc-dim">
          Your unlock progress could not be read just now. Nothing you have
          earned is affected — this is a read.
        </output>
      ) : (
        <ul className="m-0 list-none overflow-hidden rounded-xl border border-cc-rule bg-cc-surface p-0">
          {rows.map((row, index) => (
            <li
              key={row.key}
              className={
                index < rows.length - 1
                  ? "border-cc-rule border-b px-[18px] py-4"
                  : "px-[18px] py-4"
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  {row.unlocked ? null : (
                    <Lock
                      aria-hidden
                      className="mt-0.5 size-[15px] flex-none text-cc-dim2"
                      strokeWidth={1.8}
                    />
                  )}
                  <div>
                    <h3
                      className={`m-0 font-semibold text-[14.5px] ${
                        row.unlocked ? "text-cc-ink" : "text-cc-dim"
                      }`}
                    >
                      {row.title}
                    </h3>
                    <p className="m-0 mt-1 text-[12.5px] text-cc-muted leading-[1.5]">
                      {row.unlockHint}
                    </p>
                  </div>
                </div>
                <span
                  className={`flex-none whitespace-nowrap rounded-full px-[9px] py-[3px] font-semibold text-[11px] ${
                    row.unlocked
                      ? "bg-cc-pill text-cc-brand"
                      : "bg-cc-pg text-cc-dim"
                  }`}
                >
                  {BADGE_LABELS[row.state]}
                </span>
              </div>

              {row.unlocked ? (
                <AxisOptions
                  row={row}
                  chosen={personalization?.appearance[row.key] ?? UNCONFIGURED}
                  isSaving={isSaving}
                  onChoose={onChoose}
                />
              ) : null}

              {row.state === "dormant" ? (
                <DormantNote
                  axis={row.key}
                  stored={personalization?.appearance[row.key] ?? UNCONFIGURED}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The artboard's three badges. **Dormant is a third state, not a softer
 * "Locked".** It means the axis was earned, the pick is still in the column, and
 * a qualifying review brings it back; saying "Locked" there would tell a member
 * they had lost something the database still holds.
 */
const BADGE_LABELS = {
  unlocked: "Unlocked",
  dormant: "Dormant",
  locked: "Locked",
} as const;

/**
 * One axis's options, as buttons.
 *
 * `UNCONFIGURED` leads the row because it is what every node in the community
 * starts as, and because a member who picked something needs a way back to it —
 * un-picking is a choice like any other and goes through the same write.
 *
 * `aria-pressed` rather than a radio group: these are buttons that each perform
 * a write, and the pressed one is the state the server last confirmed. Nothing
 * is painted optimistically, so the highlight always says what is stored rather
 * than what was clicked.
 */
function AxisOptions({
  row,
  chosen,
  isSaving,
  onChoose,
}: {
  row: PersonalizationTierRow;
  chosen: string;
  isSaving: boolean;
  onChoose: (choice: NodeAppearanceChoice) => void;
}) {
  return (
    <ul
      aria-label={row.title}
      className="m-0 mt-3 ml-[25px] flex list-none flex-wrap gap-2 p-0"
    >
      {row.options.map((option) => {
        const selected = option === chosen;
        return (
          <li key={option}>
            <button
              type="button"
              aria-pressed={selected}
              disabled={isSaving}
              onClick={() => onChoose({ [row.key]: option })}
              className={`cursor-pointer flex h-9 items-center gap-2 rounded-[9px] border bg-cc-surface px-[13px] text-[13px] capitalize transition-colors hover:border-cc-brand disabled:cursor-not-allowed disabled:opacity-60 ${
                selected
                  ? "border-cc-brand font-semibold text-cc-brand"
                  : "border-cc-rule3 text-cc-ink"
              }`}
            >
              {row.key === "color" ? <ColorSwatch name={option} /> : null}
              {option}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The colour a name draws as, through the same table the landing canvas uses,
 * so the swatch here and the dot there cannot disagree. `"default"` resolves to
 * `--cc-brand`, which is the single dot colour the Landing artboard's own
 * palette has and what every unconfigured node renders in.
 *
 * Only the colour axis gets a swatch, which is what the artboard does
 * (`swatch: n === 1 ? … : null`). A shape or a signal is a mark on a canvas at a
 * four-pixel radius, and a legible glyph of one would be a second drawing of it
 * to keep in step with `hero-network.tsx`.
 */
function ColorSwatch({ name }: { name: string }) {
  const variable =
    name === UNCONFIGURED ? DEFAULT_NODE_COLOR_VAR : nodeColorVar(name);
  return (
    <span
      aria-hidden
      className="size-[13px] flex-none rounded-full"
      style={{ background: `var(${variable})` }}
    />
  );
}

/**
 * What a dormant axis says.
 *
 * It names the stored pick, because "reviewing again restores them" is otherwise
 * unverifiable from the one screen that claims it — a member who cannot see what
 * is waiting has only our word that anything is. Nothing here writes, and
 * nothing anywhere clears a column because a tier decayed: the value is masked
 * on the canvas and kept in the database.
 */
function DormantNote({
  axis,
  stored,
}: {
  axis: PersonalizationAxisKey;
  stored: string;
}) {
  const isColor = axis === "color";
  const known = isColor ? stored in NODE_COLOR_VARS : stored !== UNCONFIGURED;

  return (
    <p className="m-0 mt-1.5 ml-[25px] text-[12.5px] text-cc-dim">
      {known ? (
        <>
          Your node is drawn in the default while this is dormant.{" "}
          <span className="capitalize">{stored}</span> is still saved and comes
          back with your next review.
        </>
      ) : (
        "You earned this one. It comes back with your next review."
      )}
    </p>
  );
}
