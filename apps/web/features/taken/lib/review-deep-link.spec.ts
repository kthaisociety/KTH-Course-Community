import { describe, expect, it } from "vitest";
import {
  parseReviewDeepLink,
  reviewHref,
  reviewQueue,
} from "./review-deep-link";

describe("parseReviewDeepLink", () => {
  it("says nothing was asked for when the parameter is absent", () => {
    expect(parseReviewDeepLink("")).toBeNull();
    expect(parseReviewDeepLink("?tab=reviews")).toBeNull();
  });

  /** The original contract. A bookmarked link must keep working. */
  it("reads ?review=1 as the whole unreviewed set", () => {
    expect(parseReviewDeepLink("?review=1")).toEqual({ startCode: null });
  });

  it("reads a course code as the course to start on", () => {
    expect(parseReviewDeepLink("?review=DD2380")).toEqual({
      startCode: "DD2380",
    });
  });

  it("normalises the code the way course codes are stored", () => {
    expect(parseReviewDeepLink("?review=%20dd2380%20")).toEqual({
      startCode: "DD2380",
    });
  });

  /**
   * A value that can match no course is still a request for the reviewer — the
   * reader clicked something. It degrades to the whole set rather than to
   * nothing, which is also what stops the parameter being left in the URL.
   */
  it("falls back to the whole set for a value no course code could be", () => {
    expect(parseReviewDeepLink("?review=not+a+code")).toEqual({
      startCode: null,
    });
    expect(parseReviewDeepLink("?review=")).toEqual({ startCode: null });
  });
});

describe("reviewHref", () => {
  it("keeps writing the flag form when no course is named", () => {
    expect(reviewHref()).toBe("/taken?review=1");
  });

  it("carries the course when one is", () => {
    expect(reviewHref("DD2380")).toBe("/taken?review=DD2380");
  });

  it("round-trips through the parser", () => {
    const href = reviewHref("SF1625");
    expect(parseReviewDeepLink(href.slice(href.indexOf("?")))).toEqual({
      startCode: "SF1625",
    });
  });
});

describe("reviewQueue", () => {
  it("deals the set as it stands when no course is named", () => {
    expect(reviewQueue(["DD1337", "DD2380"], null)).toEqual([
      "DD1337",
      "DD2380",
    ]);
  });

  it("puts the named course first and deals the rest behind it", () => {
    expect(reviewQueue(["DD1337", "DD2380"], "DD2380")).toEqual([
      "DD2380",
      "DD1337",
    ]);
  });

  /** Reviewed since, or never taken: there is no card to deal for it. */
  it("drops a named course the set does not hold", () => {
    expect(reviewQueue(["DD1337"], "SF1625")).toEqual(["DD1337"]);
  });

  it("leaves an empty set empty", () => {
    expect(reviewQueue([], "DD2380")).toEqual([]);
  });
});
