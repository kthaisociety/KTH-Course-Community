import { describe, expect, it } from "vitest";
import {
  fromPlainText,
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
