/**
 * @vitest-environment jsdom
 *
 * The `logic` project runs on node, which has no `sessionStorage` — and this
 * file is about nothing else. A per-file environment is cheaper than moving a
 * pure-logic suite into the component project just to borrow a global.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_REVIEW_DRAFT } from "./review-draft";
import {
  clearReviewerSession,
  type ReviewerSession,
  readReviewerSession,
  writeReviewerSession,
} from "./reviewer-session";

const KEY = "cc.taken.reviewer";

function session(over: Partial<ReviewerSession> = {}): ReviewerSession {
  return { queue: ["DD2424", "SF1918"], done: {}, drafts: {}, ...over };
}

beforeEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("a round the tab remembers", () => {
  it("comes back the way it went in", () => {
    const round = session({
      done: { DD2424: "skipped" },
      drafts: { SF1918: { ...EMPTY_REVIEW_DRAFT, happyTook: true } },
    });
    writeReviewerSession(round);

    expect(readReviewerSession()).toEqual(round);
  });

  it("is nothing at all until a round has been written", () => {
    expect(readReviewerSession()).toBeNull();
  });

  it("is gone once the round is closed", () => {
    writeReviewerSession(session());
    clearReviewerSession();

    expect(readReviewerSession()).toBeNull();
  });
});

/**
 * What comes back is whatever was in the tab's storage — possibly written by an
 * older build, possibly by hand. None of it is trusted.
 */
describe("storage that cannot be believed", () => {
  it("ignores anything that is not a round", () => {
    sessionStorage.setItem(KEY, "not json at all");
    expect(readReviewerSession()).toBeNull();

    sessionStorage.setItem(KEY, JSON.stringify(["DD2424"]));
    expect(readReviewerSession()).toBeNull();

    sessionStorage.setItem(KEY, JSON.stringify({ done: {}, drafts: {} }));
    expect(readReviewerSession()).toBeNull();
  });

  /**
   * An empty queue would reopen the reviewer on a screen with no cards in it,
   * which reads as a bug rather than as continuity.
   */
  it("is not a round when there is nothing in the queue", () => {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ queue: [], done: {}, drafts: {} }),
    );
    expect(readReviewerSession()).toBeNull();
  });

  it("drops course codes that are not strings", () => {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ queue: ["DD2424", 7, null], done: {}, drafts: {} }),
    );
    expect(readReviewerSession()?.queue).toEqual(["DD2424"]);
  });

  it("drops an outcome that is not one of the two", () => {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        queue: ["DD2424", "SF1918"],
        done: { DD2424: "saved", SF1918: "deleted" },
        drafts: {},
      }),
    );
    expect(readReviewerSession()?.done).toEqual({ DD2424: "saved" });
  });

  /**
   * `methods` and `shares` are parallel arrays, and the bar's arithmetic is
   * written against that. A pair that does not line up is not a draft this
   * build can draw, so it is dropped rather than half-restored.
   */
  it("drops a draft whose bar does not line up", () => {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        queue: ["DD2424", "SF1918"],
        done: {},
        drafts: {
          DD2424: { methods: ["exam", "labs"], shares: [100] },
          SF1918: { methods: ["exam"], shares: [100], workloadScore: 6 },
        },
      }),
    );

    const round = readReviewerSession();
    expect(round?.drafts.DD2424).toBeUndefined();
    expect(round?.drafts.SF1918).toMatchObject({
      methods: ["exam"],
      shares: [100],
      workloadScore: 6,
      happyTook: null,
      message: "",
    });
  });

  it("fills a draft's missing answers with nothing rather than a value", () => {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        queue: ["DD2424"],
        done: {},
        drafts: { DD2424: { happyTook: "yes", workloadScore: "8" } },
      }),
    );

    expect(readReviewerSession()?.drafts.DD2424).toEqual(EMPTY_REVIEW_DRAFT);
  });
});

/** A tab with storage disabled still runs the reviewer; it just forgets. */
describe("a browser that will not store anything", () => {
  it("neither throws nor pretends there is a round", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => writeReviewerSession(session())).not.toThrow();
    expect(() => clearReviewerSession()).not.toThrow();
    expect(readReviewerSession()).toBeNull();
  });
});
