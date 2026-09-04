import { describe, expect, it } from "vitest";
import { pageTitleFor, WORDMARK } from "./page-title";

describe("pageTitleFor", () => {
  // The Mobile Preview's own map, line 414, against this app's routes.
  it.each([
    ["/search", "Explore courses"],
    ["/favorites", "Saved courses"],
    ["/profile", "My Page"],
  ])("names %s the way the design names it", (pathname, title) => {
    expect(pageTitleFor(pathname)).toBe(title);
  });

  it("names the pages the design does not key after their own heading", () => {
    expect(pageTitleFor("/about")).toBe("About");
    expect(pageTitleFor("/contact")).toBe("Contact");
    expect(pageTitleFor("/newsletter")).toBe("Newsletter");
  });

  it("keeps a nested route under its section's title", () => {
    expect(pageTitleFor("/course/DD2380")).toBe("Courses");
    expect(pageTitleFor("/profile/settings")).toBe("My Page");
  });

  // "/course" is a prefix of nothing else here, but the sort is what stops a
  // shorter entry winning over a longer one, so pin it.
  it("prefers the longest matching prefix", () => {
    expect(pageTitleFor("/search/anything/deeper")).toBe("Explore courses");
  });

  it("falls back to the wordmark, which is what the design titles /", () => {
    expect(pageTitleFor("/")).toBe(WORDMARK);
    expect(pageTitleFor("/reviews")).toBe(WORDMARK);
    expect(pageTitleFor("")).toBe(WORDMARK);
  });

  // A route whose name merely starts with a keyed one is a different route.
  it("does not match a route that only shares a prefix's characters", () => {
    expect(pageTitleFor("/aboutus")).toBe(WORDMARK);
    expect(pageTitleFor("/courses")).toBe(WORDMARK);
  });
});
