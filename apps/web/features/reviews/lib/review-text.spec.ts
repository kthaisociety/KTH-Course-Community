import { describe, expect, it } from "vitest";
import {
  fromPlainText,
  toEditableText,
  toExcerpt,
  toPlainText,
  toStoredMessage,
} from "./review-text";

describe("toPlainText", () => {
  it("is empty for a review nobody wrote", () => {
    expect(toPlainText(null)).toBe("");
    expect(toPlainText("")).toBe("");
  });

  it("keeps the words and drops the markup", () => {
    expect(toPlainText("<p>Do the <strong>labs</strong> early.</p>")).toBe(
      "Do the labs early.",
    );
  });

  it("decodes the entities the editor writes", () => {
    expect(toPlainText("<p>Theory &amp; practice</p>")).toBe(
      "Theory & practice",
    );
  });
});

describe("toStoredMessage", () => {
  it("stores nothing for an editor the writer never typed into", () => {
    expect(toStoredMessage("")).toBeNull();
    expect(toStoredMessage("<p><br></p>")).toBeNull();
    expect(toStoredMessage("<p>&nbsp;</p>")).toBeNull();
  });

  it("stores the markup verbatim once there are words in it", () => {
    expect(toStoredMessage("<p>Worth it.</p>")).toBe("<p>Worth it.</p>");
  });
});

describe("toExcerpt", () => {
  it("leaves a short review alone", () => {
    expect(toExcerpt("<p>Short and useful.</p>")).toBe("Short and useful.");
  });

  it("cuts a long review and never leaves a dangling comma", () => {
    const excerpt = toExcerpt(`<p>${"word, ".repeat(60)}</p>`);
    expect(excerpt.endsWith("…")).toBe(true);
    expect(excerpt).not.toMatch(/[,;\s]…$/);
    expect(excerpt.length).toBeLessThanOrEqual(158);
  });
});

describe("fromPlainText", () => {
  it("has nothing to write for an empty box", () => {
    expect(fromPlainText("")).toBe("");
    expect(fromPlainText("   \n  \n ")).toBe("");
  });

  it("wraps a line the way the column expects it", () => {
    expect(fromPlainText("Bring time.")).toBe("<p>Bring time.</p>");
  });

  /**
   * `sanitizeHtml` runs with `stripIgnoreTag`, so an unescaped `<vector>` is
   * deleted between the database and the reader. Escaping is what keeps the
   * sentence the reviewer actually typed.
   */
  it("escapes what would otherwise be read as a tag", () => {
    expect(fromPlainText("Use <vector> & <map>")).toBe(
      "<p>Use &lt;vector&gt; &amp; &lt;map&gt;</p>",
    );
  });

  it("round-trips back to the words that were typed", () => {
    expect(toPlainText(fromPlainText("Theory & practice, 5 < 10"))).toBe(
      "Theory & practice, 5 < 10",
    );
  });

  it("keeps the only structure a textarea can express", () => {
    expect(fromPlainText("One\nTwo")).toBe("<p>One<br />Two</p>");
    expect(fromPlainText("One\n\nTwo")).toBe("<p>One</p><p>Two</p>");
  });
});

/*
 * The inverse of `fromPlainText`, and the one thing editing a stored review
 * rests on. `toPlainText` is next door and is not interchangeable with it: it
 * puts a space where every tag was, which is what an excerpt wants and what a
 * write-back must not do.
 */
describe("toEditableText", () => {
  it("is empty for a review nobody wrote", () => {
    expect(toEditableText(null)).toBe("");
    expect(toEditableText(undefined)).toBe("");
    expect(toEditableText("")).toBe("");
  });

  /**
   * The bug this function exists for. `<strong>foo</strong><em>bar</em>`
   * renders as "foobar", so an author who opened that review to correct a
   * score and saved would have had a word split in two by an edit they never
   * made.
   */
  it("does not put a space inside a word that had formatting in it", () => {
    expect(toEditableText("<p><strong>foo</strong><em>bar</em></p>")).toBe(
      "foobar",
    );
    expect(toPlainText("<p><strong>foo</strong><em>bar</em></p>")).toBe(
      "foo bar",
    );
  });

  it("keeps the spaces that were really there", () => {
    expect(toEditableText("<p><strong>Do</strong> the labs early.</p>")).toBe(
      "Do the labs early.",
    );
  });

  it("brings back the structure a textarea can hold", () => {
    expect(toEditableText("<p>One<br />Two</p>")).toBe("One\nTwo");
    expect(toEditableText("<p>One</p><p>Two</p>")).toBe("One\n\nTwo");
  });

  /** Only the retired dialog could write these, and they come back as prose. */
  it("flattens what a textarea cannot express", () => {
    expect(
      toEditableText("<h2>Labs</h2><ul><li>One</li><li>Two</li></ul>"),
    ).toBe("Labs\n\nOne\n\nTwo");
  });

  it("decodes the entities that escaping put there", () => {
    expect(toEditableText("<p>Theory &amp; practice, 5 &lt; 10</p>")).toBe(
      "Theory & practice, 5 < 10",
    );
  });

  /*
   * The contract editing rests on: anything written in a textarea — which is
   * everything this app can write — survives being opened and saved. Both
   * directions are asserted, because either one alone can be right while the
   * pair still loses a character.
   */
  it("round-trips a write-up in both directions", () => {
    for (const text of [
      "Theory & practice, 5 < 10",
      "One\nTwo",
      "One\n\nTwo",
      "Use <vector> & <map>.",
      "Do the labs early.",
    ]) {
      expect(toEditableText(fromPlainText(text)), text).toBe(text);
    }

    for (const html of [
      "<p>Do the labs early.</p>",
      "<p>One<br />Two</p>",
      "<p>One</p><p>Two</p>",
      "<p>Use &lt;vector&gt; &amp; &lt;map&gt;.</p>",
    ]) {
      expect(fromPlainText(toEditableText(html)), html).toBe(html);
    }
  });
});
