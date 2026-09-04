import { describe, expect, it } from "vitest";
import { toExcerpt, toPlainText, toStoredMessage } from "./review-text";

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
