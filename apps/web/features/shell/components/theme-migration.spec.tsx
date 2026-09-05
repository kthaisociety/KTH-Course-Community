import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  THEME_KEY_MIGRATION,
  ThemeProvider,
} from "@/components/theme-provider";

/**
 * The one-time move of a saved theme preference from `next-themes`' default
 * `theme` onto the design's `cc:theme`.
 *
 * It is a script string rather than a component, because it has to execute
 * before `next-themes`' own pre-paint script rather than in an effect. So it is
 * exercised the way the browser will: evaluated against a real `localStorage`,
 * with the outcome read back out of storage.
 *
 * It lives beside the shell for the reason `theme-tokens.spec.tsx` does —
 * vitest's `ui` project is the only glob that reaches this code, `components/`
 * is not in any of them, and the shell is what mounts and flips the theme.
 */

function run() {
  // biome-ignore lint/security/noGlobalEval: the subject under test is a script string; running it is the test.
  eval(THEME_KEY_MIGRATION);
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the theme storage-key migration", () => {
  it.each(["light", "dark", "system"])(
    "carries a saved %s over to the design's key",
    (choice) => {
      window.localStorage.setItem("theme", choice);
      run();
      expect(window.localStorage.getItem("cc:theme")).toBe(choice);
    },
  );

  it("leaves a choice already made under the new key alone", () => {
    window.localStorage.setItem("theme", "light");
    window.localStorage.setItem("cc:theme", "dark");
    run();
    // The newer key is the one the reader has actually been using; the old one
    // is a leftover, and running twice must not undo the second choice.
    expect(window.localStorage.getItem("cc:theme")).toBe("dark");
  });

  it("copies nothing when there is nothing to copy", () => {
    run();
    expect(window.localStorage.getItem("cc:theme")).toBeNull();
  });

  it("ignores a legacy value next-themes would never have written", () => {
    window.localStorage.setItem("theme", "midnight");
    run();
    expect(window.localStorage.getItem("cc:theme")).toBeNull();
  });

  /**
   * Reading `localStorage` throws outright in some privacy modes rather than
   * returning null, and this runs inline in the document — an exception here
   * would abort the script and take the theme with it.
   */
  it("survives storage being unreadable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("The operation is insecure.");
    });
    expect(() => run()).not.toThrow();
  });
});

/**
 * The whole fix rests on *when* the migration runs, and that in turn rests on
 * one structural fact: both scripts are inline, so the parser runs them in
 * document order, and `next-themes` renders its pre-paint script as the first
 * child of its own provider. Rendering the migration as a sibling *before* that
 * provider is therefore the entire ordering guarantee — and it is a one-line
 * edit away from being silently lost, with no visible symptom except a returning
 * reader's preference being ignored again.
 *
 * So the order is asserted on the server render, which is the artefact the
 * browser actually parses. RTL's `render` would not do: React does not execute
 * a script it creates on the client, so a client render says nothing about
 * first paint.
 */
describe("where the migration sits in the document", () => {
  const scriptsOf = (html: string) =>
    [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

  it("is emitted before next-themes' own pre-paint script", () => {
    const html = renderToStaticMarkup(
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        storageKey="cc:theme"
      >
        <div />
      </ThemeProvider>,
    );

    const scripts = scriptsOf(html);
    expect(scripts).toHaveLength(2);
    expect(scripts[0]).toBe(THEME_KEY_MIGRATION);
    // next-themes' script is the one that resolves `prefers-color-scheme` and
    // writes the class; by then `cc:theme` is already populated.
    expect(scripts[1]).toContain("prefers-color-scheme");
  });

  it("is inert markup — no interpolation reaches the inline script", () => {
    // The `biome-ignore` on `dangerouslySetInnerHTML` is only defensible while
    // the string stays a fixed literal, so pin that rather than trust the note.
    expect(THEME_KEY_MIGRATION).not.toMatch(/\$\{|<\/script/i);
  });
});
