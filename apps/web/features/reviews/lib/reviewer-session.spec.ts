/**
 * @vitest-environment jsdom
 *
 * The `logic` project runs on node, which has no `sessionStorage` — and this
 * file is about nothing else. A per-file environment is cheaper than moving a
 * pure-logic suite into the component project just to borrow a global.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_REVIEW_DRAFT, type ReviewDraft } from "./review-draft";
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

  /**
   * The guard against a new field being dropped on the way back in.
   *
   * Both storages used to hand-decode a draft field by field over a spread of
   * `EMPTY_REVIEW_DRAFT`, which made the result structurally complete whether or
   * not the decoder had heard of every field — so a field added to `ReviewDraft`
   * compiled, type-checked, and came back empty after a reload. The
   * decoder no longer spreads the empty draft, so the omission is now a compiler
   * error; this is the same guarantee at runtime, for the day somebody puts the
   * spread back.
   *
   * `ANSWERED` is typed `ReviewDraft`, so a new field cannot be left out of the
   * fixture either — it has to be given a value, and that value then has to
   * survive the trip.
   */
  it("brings every field of a fully answered draft back", () => {
    const ANSWERED: ReviewDraft = {
      methods: ["exam", "labs"],
      shares: [60, 40],
      approachTheoryPercent: 35,
      workloadScore: 8,
      learningScore: 6,
      happyTook: true,
      message: "Hard, and worth it",
    };
    // Every field differs from the empty draft, so a dropped one shows up as a
    // difference rather than coincidentally matching the default.
    for (const [field, value] of Object.entries(ANSWERED)) {
      expect(value, field).not.toEqual(
        EMPTY_REVIEW_DRAFT[field as keyof ReviewDraft],
      );
    }

    writeReviewerSession(session({ drafts: { DD2424: ANSWERED } }));

    expect(readReviewerSession()?.drafts.DD2424).toEqual(ANSWERED);
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

  /**
   * The round is a set of courses dealt in an order. Everything downstream
   * keys progress by course code, so a repeated code would draw two cards that
   * one skip finishes and count two skipped courses.
   */
  it("keeps a repeated course code only once", () => {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        queue: ["DD2424", "SF1918", "DD2424"],
        done: {},
        drafts: {},
      }),
    );
    expect(readReviewerSession()?.queue).toEqual(["DD2424", "SF1918"]);
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
   * written against that. A pair that does not line up is not a bar this build
   * can draw — so the *bar* goes, and nothing else does.
   *
   * This file used to throw the whole card away, which is the behaviour #166
   * unified out. Two things make it wrong rather than merely strict. It does
   * not drop the card: the code stays in `queue`, so the reviewer is dealt the
   * same course with a blank form. And `reviewer.tsx` mirrors the round back to
   * storage in a `useEffect` keyed on `round`, which runs on the mount after
   * the restore — so the write-up and the scores are gone from the tab before
   * the reviewer has touched anything. The same mechanism #180 fixed in the
   * workspace pane, in the file documented as the counter-example to it.
   */
  it("keeps the answers when only the examination bar is broken", () => {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        queue: ["DD2424", "SF1918"],
        done: {},
        drafts: {
          DD2424: {
            methods: ["exam", "labs"],
            shares: [100],
            workloadScore: 9,
            happyTook: true,
            message: "Worth it",
          },
          SF1918: { methods: ["exam"], shares: [100], workloadScore: 6 },
        },
      }),
    );

    const round = readReviewerSession();
    expect(round?.drafts.DD2424).toMatchObject({
      methods: [],
      shares: [],
      workloadScore: 9,
      happyTook: true,
      message: "Worth it",
    });
    expect(round?.drafts.SF1918).toMatchObject({
      methods: ["exam"],
      shares: [100],
      workloadScore: 6,
      happyTook: null,
      message: "",
    });
  });

  /**
   * A method this build has never heard of used to be cast into
   * `ExaminationKey[]` unchecked here — the workspace pane stopped doing that
   * in #180 and this file kept doing it, which is the drift in miniature. It
   * would reach the bar as a segment with no colour and no label.
   */
  it("drops a split naming a method this build does not have", () => {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        queue: ["DD2424"],
        done: {},
        drafts: {
          DD2424: {
            methods: ["exam", "quiz"],
            shares: [60, 40],
            message: "Still mine",
          },
        },
      }),
    );

    expect(readReviewerSession()?.drafts.DD2424).toMatchObject({
      methods: [],
      shares: [],
      message: "Still mine",
    });
  });

  /** There is nothing in a string to salvage, so this one really is nothing. */
  it("drops an entry that is not a draft at all", () => {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        queue: ["DD2424", "SF1918"],
        done: {},
        drafts: { DD2424: "nope", SF1918: ["exam"] },
      }),
    );

    expect(readReviewerSession()?.drafts).toEqual({});
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
