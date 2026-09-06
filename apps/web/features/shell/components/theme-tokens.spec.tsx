import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * `app/globals.css` read as data, against the design's own token file.
 *
 * Two things are guarded here, and neither can be caught by rendering anything.
 *
 * **Parity.** `docs/design_ref/2026-09-06/cc-theme.css` is the single definition of
 * both palettes; the `:root` and `.dark` blocks are a mirror of it. A mirror
 * nobody checks drifts, and #127 §2 exists because one did. So every `--cc-*`
 * token is compared value for value, in both themes and in both directions — a
 * token the design adds and the app never mirrors fails as loudly as a value
 * someone tuned locally.
 *
 * **One palette.** `components/ui/**` styles itself against the stock shadcn
 * tokens. Those used to be a second, unrelated neutral set sitting beside
 * `--cc-*` and disagreeing with it, which is what made light look worse than
 * dark. They are aliases now — `--background: var(--cc-pg)` and so on — and
 * this asserts they stay aliases, because the failure mode is a literal quietly
 * reappearing and nothing noticing until someone opens a dialog.
 *
 * It lives beside the shell because the shell is what mounts the theme and
 * flips it, and because vitest's `ui` project (`features/**` + `*.spec.tsx`) is
 * the only glob reaching feature code outside a `lib/` folder — hence a `.tsx`
 * extension on a file that renders nothing.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const globals = readFileSync(
  path.resolve(here, "../../../app/globals.css"),
  "utf8",
);
const design = readFileSync(
  path.resolve(here, "../../../../../docs/design_ref/2026-09-06/cc-theme.css"),
  "utf8",
);

/**
 * The custom-property declarations of one top-level rule.
 *
 * Comments go first: `#faf8f1` appears inside several of them and would
 * otherwise read as a declaration. The selector is matched anchored to the
 * start of a line, because `.dark` also occurs inside
 * `@custom-variant dark (&:is(.dark *))` near the top of the file. Nesting is
 * counted rather than assumed, so an inner block cannot swallow the closing
 * brace.
 */
function declarationsOf(css: string, selector: string): Map<string, string> {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rule = new RegExp(
    `^${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{`,
    "m",
  ).exec(source);
  if (!rule) throw new Error(`${selector} is missing from the stylesheet`);

  let depth = 0;
  let cursor = source.indexOf("{", rule.index);
  const open = cursor;
  for (;;) {
    if (source[cursor] === "{") depth += 1;
    else if (source[cursor] === "}" && --depth === 0) break;
    cursor += 1;
  }

  const declarations = new Map<string, string>();
  const body = source.slice(open + 1, cursor);
  for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    declarations.set(name, normalise(value));
  }
  return declarations;
}

/**
 * The two files write the same colour differently — the design has
 * `rgba(23, 81, 166, .07)` where Biome has reformatted ours to `0.07` — so the
 * channels of an `rgb()` are compared as numbers. Everything else is a hex,
 * which both files already write in lower case.
 */
function normalise(value: string): string {
  const text = value.trim().toLowerCase();
  const channels = /^rgba?\(([^)]*)\)$/.exec(text);
  if (!channels) return text;
  const parts = channels[1].split(",").map((part) => Number(part.trim()));
  return `rgba(${parts.join(", ")})`;
}

/** `--warnBtnFg` in the design is `--cc-warn-btn-fg` here. */
function ccNameFor(designToken: string): string {
  return `--cc-${designToken.slice(2).replace(/[A-Z]/g, "-$&").toLowerCase()}`;
}

/**
 * `--cc-*` tokens the app names and `cc-theme.css` does not.
 *
 * The parity check below is the point of this file and this list is a hole in
 * it, so it is a list rather than a predicate: adding to it is a visible edit
 * with a reason attached, and everything not on it still fails as loudly as
 * before.
 *
 * - `--cc-applied` — the applied end of a theory/applied bar. The artboards
 *   write `#9dbfe4` inline for it (`Course Community - Workspace Pane.dc.html`
 *   at `:115`, and four other artboards reuse the hex for other things) and no
 *   export has ever given it a name. Three call sites derived it with
 *   `color-mix` instead; #173 named it here so the derivation cannot silently
 *   re-resolve when `--cc-btn` moves. Its dark value is the one `--cc-*` value
 *   in `globals.css` chosen locally, because the artboards hardcode the light
 *   hex in both themes. When an export names it, delete this entry and the
 *   parity check picks it up.
 * - `--cc-rail-btn`, `--cc-rail-btn-fg` — the rail's "Sign up". `cc-theme.css`
 *   names neither, and the artboards disagree: six write `#8bb3ef`/`#0a2449`
 *   inline, Landing:151 writes `#fff`/`#12417f`. Settled per theme, so the two
 *   blocks differ. When an export names them, delete this entry.
 */
const UNNAMED_BY_THE_DESIGN = new Set([
  "--cc-applied",
  "--cc-rail-btn",
  "--cc-rail-btn-fg",
]);

const PALETTES = [
  { theme: "light", ours: ":root", theirs: ":root" },
  { theme: "dark", ours: ".dark", theirs: '[data-cc-theme="dark"]' },
] as const;

describe.each(PALETTES)("the $theme palette", (palette) => {
  const ours = declarationsOf(globals, palette.ours);
  const designed = new Map(
    [...declarationsOf(design, palette.theirs)].map(([token, value]) => [
      ccNameFor(token),
      value,
    ]),
  );

  it("mirrors every token in cc-theme.css, value for value", () => {
    const mirrored = new Map([...ours].filter(([name]) => designed.has(name)));
    expect(Object.fromEntries(mirrored)).toEqual(Object.fromEntries(designed));
  });

  it("adds nothing to the `--cc-*` namespace the design does not define", () => {
    const extra = [...ours.keys()].filter(
      (name) =>
        name.startsWith("--cc-") &&
        !designed.has(name) &&
        !UNNAMED_BY_THE_DESIGN.has(name),
    );
    expect(extra).toEqual([]);
  });

  /**
   * A hole in the parity check is only safe while it is still needed. An export
   * that names one of these leaves the entry behind exempting a token the
   * design now defines — which would let its value drift with nothing checking,
   * in the one place someone had already decided checking mattered.
   */
  it("does not exempt a token the design has since named", () => {
    const named = [...UNNAMED_BY_THE_DESIGN].filter((name) =>
      designed.has(name),
    );
    expect(named).toEqual([]);
  });

  /** And an exemption for a token nobody declares any more is dead weight. */
  it("does not exempt a token globals.css no longer declares", () => {
    const gone = [...UNNAMED_BY_THE_DESIGN].filter((name) => !ours.has(name));
    expect(gone).toEqual([]);
  });
});

describe("the shadcn primitives", () => {
  const root = declarationsOf(globals, ":root");

  /**
   * The tokens that honestly have no `--cc-*` counterpart, each with its reason
   * recorded in `globals.css` beside it: the radius is a length, `--chart-*` is
   * a categorical scale the design never drew and nothing consumes, and the
   * rail is the one surface the design paints in plain white at alpha because
   * there is no `--cc-rail-fg`.
   */
  const LITERALS = new Set([
    "--radius",
    "--chart-1",
    "--chart-2",
    "--chart-3",
    "--chart-4",
    "--chart-5",
    "--sidebar-foreground",
    "--sidebar-primary",
    "--sidebar-accent",
    "--sidebar-accent-foreground",
    "--sidebar-border",
    "--sidebar-ring",
  ]);

  it("are aliases onto Course Community tokens, not a second palette", () => {
    const literals = [...root]
      .filter(([name]) => !name.startsWith("--cc-") && !LITERALS.has(name))
      .filter(([, value]) => !/^var\(--cc-[\w-]+\)$/.test(value))
      .map(([name]) => name);

    expect(literals).toEqual([]);
  });

  it("cover every token `components/ui/**` paints with", () => {
    for (const token of [
      "--background",
      "--foreground",
      "--card",
      "--card-foreground",
      "--popover",
      "--popover-foreground",
      "--primary",
      "--primary-foreground",
      "--secondary",
      "--secondary-foreground",
      "--muted",
      "--muted-foreground",
      "--accent",
      "--accent-foreground",
      "--destructive",
      "--border",
      "--input",
      "--ring",
      "--sidebar",
      "--sidebar-primary-foreground",
    ]) {
      expect(root.get(token), token).toMatch(/^var\(--cc-[\w-]+\)$/);
    }
  });

  it("are declared once, on the element the theme class lands on", () => {
    // An alias resolves against whichever `--cc-*` are in scope where it is
    // declared, and `next-themes` puts `.dark` on the same `<html>` that
    // `:root` selects, so one declaration covers both themes. Repeating one
    // under `.dark` would be a second copy to keep in step, and a copy left on
    // a stale value is exactly the drift this file exists to catch.
    const dark = declarationsOf(globals, ".dark");
    expect(
      [...dark.keys()].filter((name) => !name.startsWith("--cc-")),
    ).toEqual([]);
  });
});

/**
 * The focus rule, which is a mirror of the export in the same way the tokens
 * are — and carries one deliberate divergence that has to survive.
 */
describe("the focus treatment", () => {
  it("mirrors `cc-theme.css`, including the on-rail pair", () => {
    for (const declaration of [
      "outline: 2px solid var(--cc-focus)",
      "outline-offset: 2px",
      "box-shadow: 0 0 0 4px var(--cc-focus-ring)",
      "outline-color: var(--cc-rail-focus)",
      "box-shadow: 0 0 0 4px var(--cc-rail-focus-ring)",
    ]) {
      expect(globals).toContain(declaration);
    }
    // The export scopes its rules under `[data-cc-theme]`; this app applies
    // them everywhere, including the shadcn primitives that render outside a
    // themed subtree. That is the one intended difference.
    expect(design).toContain("[data-cc-theme] :focus-visible");
  });

  /**
   * `tabindex="-1"` is how Radix marks a focus-trap container — `DialogContent`
   * carries it — and a container is not a keyboard-focused control. Without the
   * guard the rule paints a 2px ring around the whole modal and, because its
   * halo is a `box-shadow`, replaces the artboard's drop shadow with it.
   *
   * Measured in Chrome rather than reasoned: a `tabindex="-1"` element focused
   * by script matches `:focus-visible` when the interaction before it was the
   * keyboard, and does not when it was the mouse. So the symptom is real and
   * appears for keyboard users only, which is what makes it worth a test.
   */
  it("excludes focus-trap containers, so a dialog keeps its shadow", () => {
    expect(globals).toContain(':focus-visible:not([tabindex="-1"])');
    // Never the bare selector: that is the form that takes the shadow away.
    expect(globals).not.toMatch(/^:focus-visible \{/m);
    expect(globals).not.toMatch(/^\[data-cc-sidebar\] :focus-visible \{/m);
  });
});
