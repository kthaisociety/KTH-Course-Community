import { describe, expect, it } from "vitest";
import { initialsOf } from "./initials";

describe("initialsOf", () => {
  it("takes the first letter of each name part", () => {
    expect(initialsOf("Elsa Lindqvist", "elsa@kth.se")).toBe("EL");
  });

  it("stops at two letters", () => {
    expect(initialsOf("Anna Maria Sofia Berg", "anna@kth.se")).toBe("AM");
  });

  it("ignores the runs of whitespace a pasted name carries", () => {
    expect(initialsOf("  Elsa   Lindqvist  ", "elsa@kth.se")).toBe("EL");
  });

  // A magic-link account has an email and nothing else until the reader sets a
  // name, which is the common case this has to stay sensible for.
  it("falls back to the email when there is no name", () => {
    expect(initialsOf("", "harriet@kth.se")).toBe("H");
  });

  it("falls back to the email when the name is only whitespace", () => {
    expect(initialsOf("   ", "harriet@kth.se")).toBe("H");
  });

  it("has a mark to draw even with neither", () => {
    expect(initialsOf("", "")).toBe("?");
  });
});
