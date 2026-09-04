import { describe, expect, it } from "vitest";
import { pageTitleFor, WORDMARK } from "./page-title";

/**
 * Every route that renders inside `AppShell` — the whole of `app/(service)` and
 * `app/(public)`. `/`, `/auth` and `/editor-00` sit outside both groups and get
 * no shell, so no title.
 *
 * Add a route to either group and add it here: the shell titles its own header
 * from this map, and a route missing from it shows the wordmark instead of its
 * own name.
 */
const ROUTES_INSIDE_THE_SHELL = [
  "/search",
  "/course",
  "/course/DD2380",
  "/saved",
  "/taken",
  "/collections",
  "/profile",
  "/reviews",
  "/about",
  "/contact",
  "/newsletter",
];

describe("pageTitleFor", () => {
  // The Mobile Preview's own map, line 414, against this app's routes.
  it.each([
    ["/search", "Explore courses"],
    ["/saved", "Saved courses"],
    ["/profile", "My Page"],
    ["/taken", "Taken courses"],
  ])("names %s the way the design names it", (pathname, title) => {
    expect(pageTitleFor(pathname)).toBe(title);
  });

  it("names the pages the design does not key after their own heading", () => {
    expect(pageTitleFor("/about")).toBe("About");
    expect(pageTitleFor("/contact")).toBe("Contact");
    expect(pageTitleFor("/newsletter")).toBe("Newsletter");
    expect(pageTitleFor("/reviews")).toBe("Reviews");
    expect(pageTitleFor("/collections")).toBe("Collections");
  });

  it.each(ROUTES_INSIDE_THE_SHELL)(
    "leaves no route in the shell falling back to the wordmark: %s",
    (pathname) => {
      expect(pageTitleFor(pathname)).not.toBe(WORDMARK);
    },
  );

  it("keeps a nested route under its section's title", () => {
    expect(pageTitleFor("/course/DD2380")).toBe("Courses");
    expect(pageTitleFor("/profile/settings")).toBe("My Page");
  });

  it("prefers the longest matching prefix", () => {
    expect(pageTitleFor("/search/anything/deeper")).toBe("Explore courses");
  });

  it("falls back to the wordmark, which is what the design titles /", () => {
    expect(pageTitleFor("/")).toBe(WORDMARK);
    expect(pageTitleFor("")).toBe(WORDMARK);
    expect(pageTitleFor("/nothing-here")).toBe(WORDMARK);
  });

  // A route whose name merely starts with a keyed one is a different route.
  it("does not match a route that only shares a prefix's characters", () => {
    expect(pageTitleFor("/aboutus")).toBe(WORDMARK);
    expect(pageTitleFor("/courses")).toBe(WORDMARK);
  });
});
