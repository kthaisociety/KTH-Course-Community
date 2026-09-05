"use client";

import { Lock } from "lucide-react";
import {
  DEFAULT_NODE_COLOR_VAR,
  NODE_COLOR_VARS,
  type NodeColorName,
} from "@/features/landing";
import { personalizationTierRows } from "../lib/personalization-tiers";

/** The six stored colour names, in the order `server/graph/placement.ts` lists them. */
const NODE_COLOR_NAMES = Object.keys(NODE_COLOR_VARS) as NodeColorName[];

type Props = {
  /**
   * The viewer's **effective** tier, from `graph.effectiveTier`. Never the
   * earned one: the earned value is the highest ever reached and is never
   * lowered, so nothing here may be phrased as having lost a tier.
   */
  effectiveTier: number | undefined;
  /** The tier could not be read at all — distinct from an effective tier of 0. */
  isUnavailable: boolean;
};

/**
 * How far the viewer has unlocked their **node profile** — a node's appearance,
 * stored separately from graph topology. This is the tab the artboard labels
 * "My dot" (`docs/design_ref/2026-09-05/Course Community - My Page.dc.html`, its
 * `isDot` branch); `CONTEXT.md` licenses "dot" for the **Find your dot** flow's
 * copy alone, so the label stays and the identifiers say what the glossary says.
 *
 * **Tiers are earned now, but nothing here is choosable yet.** The artboard
 * renders each unlocked tier as a row of pickable options and writes the choice
 * back. Half of that exists: `server/graph/tier.ts` raises
 * `users.personalization_tier_earned` from ADR 0005's ladder, so a row can
 * genuinely read as unlocked. The other half does not — there is still no
 * procedure that writes `users_node_profiles`, since `graph` exposes only
 * `join`, `neighbourhood`, `publicWindow` and `effectiveTier`, and placement
 * stores the column default. The palette is therefore shown as what the colours
 * *are*, not as buttons that would silently do nothing. Two of the three axes
 * could not offer a choice regardless — `node_style` and `node_signal_style`
 * are Postgres enums with exactly one value each, so unlocking them today
 * unlocks a set of one.
 *
 * The colours are drawn from `--cc-node-*`, mapped from the stored **names**
 * through the same table the landing page's canvas uses. The server stores a
 * name and never a hex; `cc-store.js` inverts that — its `NODE_COLORS` is five
 * hex strings — and is wrong about the shape. Its remark that "Tier 0 accounts keep the default
 * look; only personalized nodes carry a row" was true of every account until
 * the tier writer shipped, and is now true only of accounts that have not
 * contributed.
 */
export function NodeProfile({ effectiveTier, isUnavailable }: Props) {
  const rows = personalizationTierRows(effectiveTier ?? 0);

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
                  {row.unlocked ? "Unlocked" : "Locked"}
                </span>
              </div>

              {row.unlocked && row.key === "color" ? <NodePalette /> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The node colours, named and swatched. Shown, not offered.
 *
 * The default leads the row because it is the colour of every node in the
 * community: `users_node_profiles.color` defaults to `"default"`, placement
 * stores exactly that, and the landing canvas draws it in `--cc-brand`. The
 * artboard's own list opens on the same brand blue.
 *
 * This used to say a colour was assigned on joining, which was true of the code
 * and wrong of the product — placement hashed each app user onto one of the six
 * and gave everybody a colour nobody chose. It no longer does, so the row below
 * says what is actually the case.
 */
function NodePalette() {
  const swatches = [
    { name: "default", variable: DEFAULT_NODE_COLOR_VAR, isDefault: true },
    ...NODE_COLOR_NAMES.map((name) => ({
      name,
      variable: NODE_COLOR_VARS[name],
      isDefault: false,
    })),
  ];

  return (
    <div className="mt-3 ml-[25px]">
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {swatches.map((swatch) => (
          <li
            key={swatch.name}
            className={`flex h-9 items-center gap-2 rounded-[9px] border bg-cc-surface px-[13px] text-[13px] capitalize ${
              swatch.isDefault
                ? "border-cc-brand font-semibold text-cc-brand"
                : "border-cc-rule3 text-cc-ink"
            }`}
          >
            <span
              aria-hidden
              className="size-[13px] flex-none rounded-full"
              style={{ background: `var(${swatch.variable})` }}
            />
            {swatch.name}
          </li>
        ))}
      </ul>
      <p className="m-0 mt-2 text-[12px] text-cc-dim2">
        Every node is the default colour. The other six are the palette
        personalisation will use — nobody is assigned one, and choosing one is
        not available yet.
      </p>
    </div>
  );
}
