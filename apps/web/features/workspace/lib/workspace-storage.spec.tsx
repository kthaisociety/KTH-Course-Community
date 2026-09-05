import { afterEach, describe, expect, it, vi } from "vitest";
import { EMPTY_REVIEW_DRAFT, type ReviewDraft } from "./review-draft";
import {
  claimAwaitingSignIn,
  markAwaitingSignIn,
  readDrafts,
  readPublished,
  readWorkspace,
  writeDrafts,
  writePublished,
  writeWorkspace,
} from "./workspace-storage";

/*
 * A `.spec.tsx` for a module with no JSX in it, on purpose.
 *
 * The `logic` vitest project runs `features/**` + `/lib/**` + `.spec.ts` in a node
 * environment with no DOM, which is right for the arithmetic next door in
 * `open-courses.ts` and useless here — this module is about `localStorage` and
 * `sessionStorage`, and there is nothing to assert without them. The `ui`
 * project is the one with jsdom, and it takes `.spec.tsx`. The extension is the
 * only thing choosing between them.
 */

const DRAFTS_KEY = "cc.workspace.drafts";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function draftWith(over: Partial<ReviewDraft> = {}): ReviewDraft {
  return { ...EMPTY_REVIEW_DRAFT, message: "Half a thought", ...over };
}

/** What is actually sitting in the browser, decoder and all bypassed. */
function storedDrafts(): Record<string, { savedAt: number; draft: unknown }> {
  return JSON.parse(localStorage.getItem(DRAFTS_KEY) ?? "{}");
}

function storeRawDraft(
  courseCode: string,
  draft: unknown,
  savedAt = Date.now(),
) {
  localStorage.setItem(
    DRAFTS_KEY,
    JSON.stringify({ [courseCode]: { savedAt, draft } }),
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("drafts", () => {
  /*
   * The storage a draft is in is not a detail — it is the whole of whether the
   * magic-link path works. That link is opened in a new tab, where per-tab
   * storage is empty by construction, so a draft in `sessionStorage` is a draft
   * that cannot be there. This asserts the *location*, because a round trip
   * would pass either way.
   */
  it("keeps a draft in localStorage, where a new tab can still find it", () => {
    writeDrafts({ DD2380: draftWith() });

    expect(localStorage.getItem(DRAFTS_KEY)).not.toBeNull();
    expect(sessionStorage.getItem(DRAFTS_KEY)).toBeNull();
    expect(readDrafts().DD2380?.message).toBe("Half a thought");
  });

  it("forgets a draft nobody came back to for a week", () => {
    storeRawDraft("DD2380", draftWith(), Date.now() - WEEK_MS - 1000);

    expect(readDrafts()).toEqual({});
  });

  it("keeps one that is only a day old", () => {
    storeRawDraft("DD2380", draftWith(), Date.now() - 24 * 60 * 60 * 1000);

    expect(readDrafts().DD2380?.message).toBe("Half a thought");
  });

  /*
   * The stamp measures the draft, not the workspace. Every keystroke rewrites
   * the whole record — the pane mirrors its state — so a stamp that moved on
   * every write would keep an abandoned draft alive for as long as the student
   * kept working on the tab beside it, and the week would never elapse.
   */
  it("leaves the stamp alone while the draft says the same thing", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    writeDrafts({ DD2380: draftWith() });
    const first = storedDrafts().DD2380.savedAt;

    vi.setSystemTime(new Date("2026-01-03T00:00:00Z"));
    writeDrafts({ DD2380: draftWith() });

    expect(storedDrafts().DD2380.savedAt).toBe(first);
  });

  it("moves the stamp when the draft changes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    writeDrafts({ DD2380: draftWith() });
    const first = storedDrafts().DD2380.savedAt;

    vi.setSystemTime(new Date("2026-01-03T00:00:00Z"));
    writeDrafts({ DD2380: draftWith({ message: "A whole thought" }) });

    expect(storedDrafts().DD2380.savedAt).toBeGreaterThan(first);
  });

  // What `publish()` does: it hands the pane an empty draft for the course it
  // just sent. That has to be a delete, not a stored blank.
  it("drops a draft that has been emptied, which is how publishing clears up", () => {
    writeDrafts({ DD2380: draftWith(), SF1626: draftWith() });

    writeDrafts({ DD2380: EMPTY_REVIEW_DRAFT, SF1626: draftWith() });

    expect(storedDrafts().DD2380).toBeUndefined();
    expect(readDrafts().SF1626).toBeDefined();
  });

  /*
   * `localStorage` is shared between tabs, which is the point — and the hazard.
   * A pane rewriting its whole record used to be exactly right, because the
   * record *was* the tab's storage. Now a second tab writing its own record
   * must not take the first tab's work with it.
   */
  it("leaves a draft it has never heard of where another tab put it", () => {
    writeDrafts({ SF1626: draftWith({ message: "Written next door" }) });

    writeDrafts({ DD2380: draftWith() });

    expect(readDrafts().SF1626?.message).toBe("Written next door");
    expect(readDrafts().DD2380?.message).toBe("Half a thought");
  });

  it("survives a browser that refuses storage entirely", () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("storage disabled");
      });
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("storage disabled");
      });

    expect(readDrafts()).toEqual({});
    expect(() => writeDrafts({ DD2380: draftWith() })).not.toThrow();

    getItem.mockRestore();
    setItem.mockRestore();
  });
});

/*
 * A decoder that rejects is a decoder that deletes, because the pane writes its
 * state straight back over storage. So a stored draft that is wrong in one
 * field has to come back missing that field and nothing else.
 */
describe("a stored draft that does not quite fit", () => {
  it("keeps the write-up and the scores when the examination split is broken", () => {
    storeRawDraft("DD2380", {
      ...draftWith({ workloadScore: 8, happyTook: true }),
      methods: ["exam", "labs"],
      shares: [60],
    });

    const draft = readDrafts().DD2380;
    expect(draft?.message).toBe("Half a thought");
    expect(draft?.workloadScore).toBe(8);
    expect(draft?.happyTook).toBe(true);
    expect(draft?.methods).toEqual([]);
    expect(draft?.shares).toEqual([]);
  });

  // A method this build has never heard of used to be cast into
  // `ExaminationKey[]` unchecked and drawn as a segment with no colour.
  it("drops a split naming a method this build does not have", () => {
    storeRawDraft("DD2380", {
      ...draftWith(),
      methods: ["exam", "quiz"],
      shares: [60, 40],
    });

    expect(readDrafts().DD2380?.methods).toEqual([]);
    expect(readDrafts().DD2380?.message).toBe("Half a thought");
  });

  it("drops a split that does not add up to 100", () => {
    storeRawDraft("DD2380", {
      ...draftWith(),
      methods: ["exam", "labs"],
      shares: [60, 30],
    });

    expect(readDrafts().DD2380?.methods).toEqual([]);
  });

  it("keeps a split that is entirely fine", () => {
    storeRawDraft("DD2380", {
      ...draftWith(),
      methods: ["exam", "labs"],
      shares: [60, 40],
    });

    expect(readDrafts().DD2380?.methods).toEqual(["exam", "labs"]);
    expect(readDrafts().DD2380?.shares).toEqual([60, 40]);
  });

  it("ignores an entry that is not a draft at all", () => {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify({ DD2380: "nope" }));

    expect(readDrafts()).toEqual({});
  });

  it("ignores an entry with no stamp, which no build of this ever wrote", () => {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify({ DD2380: draftWith() }));

    expect(readDrafts()).toEqual({});
  });
});

/*
 * Everything else stayed in the tab, and the split is the point of the change:
 * an open workspace belongs to the tab it was opened in, a half-written review
 * belongs to the person who wrote it.
 */
describe("what stayed in the tab", () => {
  it("keeps the open list in sessionStorage", () => {
    writeWorkspace({
      open: [{ id: "review:DD2380", courseCode: "DD2380", kind: "review" }],
      activeId: "review:DD2380",
    });

    expect(sessionStorage.getItem("cc.workspace.open")).not.toBeNull();
    expect(localStorage.getItem("cc.workspace.open")).toBeNull();
    expect(readWorkspace().open).toHaveLength(1);
  });

  it("keeps the published note in sessionStorage", () => {
    writePublished({ DD2380: 1700000000000 });

    expect(sessionStorage.getItem("cc.workspace.published")).not.toBeNull();
    expect(localStorage.getItem("cc.workspace.published")).toBeNull();
    expect(readPublished().DD2380).toBe(1700000000000);
  });

  it("keeps the awaiting-sign-in note in sessionStorage, and spends it once", () => {
    markAwaitingSignIn("DD2380");

    expect(localStorage.getItem("cc.workspace.awaiting-sign-in")).toBeNull();
    expect(claimAwaitingSignIn("SF1626")).toBe(false);
    expect(claimAwaitingSignIn("DD2380")).toBe(true);
    expect(claimAwaitingSignIn("DD2380")).toBe(false);
  });
});
