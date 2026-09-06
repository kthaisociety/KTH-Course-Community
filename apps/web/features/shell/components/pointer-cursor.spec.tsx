import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Every clickable renders a pointer cursor — checked as source, because nothing
 * rendered can catch it.
 *
 * Tailwind v3's preflight gave `<button>` a pointer; v4 removed it, and that is
 * the whole cause. Every artboard writes `cursor:pointer` on every clickable, so
 * the design has one answer and the framework quietly stopped supplying it. The
 * gap is invisible in review — a button with no `cursor-*` class looks like a
 * button that did not need one — and invisible in a DOM test, because jsdom
 * computes no cursor. It shows up only on a real screen, one control at a time.
 *
 * Two things are guarded.
 *
 * **The primitive.** `components/ui/button.tsx` carries `cursor-pointer` in its
 * `cva` base, which is what covers every `<Button>` at once. That is asserted by
 * rendering, below.
 *
 * **The hand-rolled buttons.** `features/**` writes most of its own buttons as
 * bare `<button>` elements with a `className`, and those get no help from the
 * primitive. This sweeps the source for them.
 *
 * It lives beside `theme-tokens.spec.tsx` for the same reason that one does:
 * vitest's `ui` project (`features/**` + `*.spec.tsx`) is the only glob reaching
 * feature code outside a `lib/` folder, so an app-wide invariant expressed over
 * source needs a `.tsx` extension and a home under `features/`. The shell is
 * where this repo already keeps app-wide invariants.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const featuresRoot = path.resolve(here, "../..");

/** Every non-test `.tsx` under `features/`. */
function featureComponents(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...featureComponents(full));
    } else if (entry.endsWith(".tsx") && !entry.includes(".spec.")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Source with comments blanked out, so prose about a `<button>` is not mistaken
 * for one. Two docstrings in this repo discuss `<button>` and its cursor by
 * name — `unreviewed-card.tsx` and `workspace-pane-host.tsx` — and an earlier
 * pass over this same question counted both as unfixed render sites. Replacing
 * each comment with spaces of equal length keeps every later offset, and so
 * every reported line number, correct.
 */
function withoutComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (match) =>
    match.replace(/[^\n]/g, " "),
  );
}

/**
 * The text of one JSX opening tag, from `<` to the `>` that closes it.
 *
 * Brace- and quote-aware: a `className={cn(...)}` spans lines and contains both
 * `>` (in arrow functions) and quoted strings, so scanning to the first `>`
 * would truncate the tag and miss the class it carries.
 */
function openingTag(src: string, start: number): string {
  let depth = 0;
  let quote: string | null = null;
  for (let i = start; i < src.length; i += 1) {
    const c = src[i];
    if (quote) {
      if (c === quote && src[i - 1] !== "\\") quote = null;
    } else if (c === '"' || c === "'" || c === "`") {
      quote = c;
    } else if (c === "{") {
      depth += 1;
    } else if (c === "}") {
      depth -= 1;
    } else if (c === ">" && depth === 0) {
      return src.slice(start, i + 1);
    }
  }
  return src.slice(start);
}

/**
 * Identifiers in this file whose definition contains `cursor-pointer`.
 *
 * Several components hoist a shared class string — `ROW_CLASS`,
 * `ACTION_BUTTON`, `ICON_BUTTON` — and a button that reaches one of those is
 * already covered. Missing this is what made two hand counts of this same
 * question disagree, so it is resolved here rather than left to the reader.
 */
function classConstants(src: string): Set<string> {
  const named = new Set<string>();
  const declaration =
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]*)?=\s*/g;
  for (const match of src.matchAll(declaration)) {
    const from = match.index + match[0].length;
    const rest = src.slice(from, from + 1200);
    const end = rest.search(/\n(?:const|function|export|type|interface)\s/);
    const body = end === -1 ? rest : rest.slice(0, end);
    if (body.includes("cursor-pointer")) named.add(match[1]);
  }
  return named;
}

function buttonsWithoutPointer(file: string): number[] {
  const src = withoutComments(readFileSync(file, "utf8"));
  const constants = classConstants(src);
  const lines: number[] = [];
  for (const match of src.matchAll(/<button\b/g)) {
    const tag = openingTag(src, match.index);
    if (tag.includes("cursor-pointer")) continue;
    const reachesConstant = [...tag.matchAll(/\b([A-Za-z_$][\w$]*)\b/g)].some(
      (id) => constants.has(id[1]),
    );
    if (reachesConstant) continue;
    lines.push(src.slice(0, match.index).split("\n").length);
  }
  return lines;
}

describe("pointer cursor", () => {
  it("is in the Button primitive's base classes, so every <Button> has one", () => {
    const button = readFileSync(
      path.resolve(here, "../../../components/ui/button.tsx"),
      "utf8",
    );
    const base = button.slice(
      button.indexOf("const buttonVariants = cva("),
      button.indexOf("{\n    variants:"),
    );
    expect(base).toContain("cursor-pointer");
  });

  it("is on every hand-rolled <button> in features/", () => {
    const offenders: string[] = [];
    for (const file of featureComponents(featuresRoot)) {
      for (const line of buttonsWithoutPointer(file)) {
        offenders.push(`${path.relative(featuresRoot, file)}:${line}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("counts a button that reaches a shared class constant as covered", () => {
    // Guards the sweep itself: without constant resolution this file's own
    // `ROW_CLASS` button reads as an offender, and the suite would demand a
    // duplicate `cursor-pointer` at a call site that already has one.
    const unreviewed = path.resolve(
      here,
      "../../reviews/components/unreviewed-card.tsx",
    );
    const src = withoutComments(readFileSync(unreviewed, "utf8"));
    expect(classConstants(src)).toContain("ROW_CLASS");
    expect(buttonsWithoutPointer(unreviewed)).toEqual([]);
  });
});
