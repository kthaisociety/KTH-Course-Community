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

/** Two accounts, and the bucket a signed-out visitor writes under. */
const ME = "user-me";
const OTHER = "user-other";
const ANON = "";

function draftWith(over: Partial<ReviewDraft> = {}): ReviewDraft {
  return { ...EMPTY_REVIEW_DRAFT, message: "Half a thought", ...over };
}

/**
 * A pane writing drafts it has just typed — nothing synchronised yet, so every
 * course named is one this tab changed. The baseline is the whole point of the
 * second argument, so the tests that care about it pass their own.
 */
function writeFresh(drafts: Record<string, ReviewDraft>, owner = ME) {
  writeDrafts(drafts, {}, owner);
}

/** What is actually sitting in one owner's bucket, decoder bypassed. */
function storedDrafts(
  owner = ME,
): Record<string, { savedAt: number; draft: unknown }> {
  const buckets = JSON.parse(localStorage.getItem(DRAFTS_KEY) ?? "{}");
  return buckets[owner] ?? {};
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
    writeFresh({ DD2380: draftWith() });

    expect(localStorage.getItem(DRAFTS_KEY)).not.toBeNull();
    expect(sessionStorage.getItem(DRAFTS_KEY)).toBeNull();
    expect(readDrafts(ME).DD2380?.message).toBe("Half a thought");
  });

  /**
   * The guard against a new field being dropped on the way back in — #166, the
   * defect underneath the duplication.
   *
   * This file's decoder and `features/reviews/lib/reviewer-session.ts`'s both
   * spread `EMPTY_REVIEW_DRAFT` and then copied across the fields they knew
   * about, so a field added to the draft compiled in both, type-checked in
   * both, and came back empty on the next reload from whichever one you forgot.
   * They now share one decoder, and it defaults nothing — an unhandled field is
   * a compiler error. This is the same guarantee at runtime.
   *
   * `ANSWERED` is typed, so a new field has to be given a value here too, and
   * every value differs from the empty draft's so a dropped one shows up rather
   * than coincidentally matching the default.
   */
  it("brings every field of a fully answered draft back", () => {
    const ANSWERED: ReviewDraft = {
      methods: ["exam", "labs"],
      shares: [60, 40],
      approachTheoryPercent: 35,
      approachForgotten: true,
      examinationForgotten: true,
      workloadScore: 8,
      learningScore: 6,
      happyTook: true,
      message: "Hard, and worth it",
    };
    for (const [field, value] of Object.entries(ANSWERED)) {
      expect(value, field).not.toEqual(
        EMPTY_REVIEW_DRAFT[field as keyof ReviewDraft],
      );
    }

    writeFresh({ DD2380: ANSWERED });

    expect(readDrafts(ME).DD2380).toEqual(ANSWERED);
  });

  it("forgets a draft nobody came back to for a week", () => {
    storeRawDraft("DD2380", draftWith(), Date.now() - WEEK_MS - 1000);

    expect(readDrafts(ME)).toEqual({});
  });

  it("keeps one that is only a day old", () => {
    storeRawDraft("DD2380", draftWith(), Date.now() - 24 * 60 * 60 * 1000);

    expect(readDrafts(ME).DD2380?.message).toBe("Half a thought");
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
    writeFresh({ DD2380: draftWith() });
    const first = storedDrafts().DD2380.savedAt;

    vi.setSystemTime(new Date("2026-01-03T00:00:00Z"));
    writeFresh({ DD2380: draftWith() });

    expect(storedDrafts().DD2380.savedAt).toBe(first);
  });

  it("moves the stamp when the draft changes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    writeFresh({ DD2380: draftWith() });
    const first = storedDrafts().DD2380.savedAt;

    vi.setSystemTime(new Date("2026-01-03T00:00:00Z"));
    writeFresh({ DD2380: draftWith({ message: "A whole thought" }) });

    expect(storedDrafts().DD2380.savedAt).toBeGreaterThan(first);
  });

  // What `publish()` does: it hands the pane an empty draft for the course it
  // just sent. That has to be a delete, not a stored blank — and the baseline
  // is what says so, since an empty draft a tab never had is not a deletion.
  it("drops a draft that has been emptied, which is how publishing clears up", () => {
    const held = { DD2380: draftWith(), SF1626: draftWith() };
    writeFresh(held);

    writeDrafts({ ...held, DD2380: EMPTY_REVIEW_DRAFT }, held, ME);

    expect(storedDrafts().DD2380).toBeUndefined();
    expect(readDrafts(ME).SF1626).toBeDefined();
  });

  /*
   * A tab carries every draft it hydrated, including ones it has not touched
   * since. Writing that whole record back would replace a course another tab
   * has moved on with the copy this tab happens to still be holding — losing
   * newer work on the way to saving an unrelated draft. The baseline is what
   * tells "I changed this" apart from "I am still holding it".
   */
  it("does not write back a course it is only still holding", () => {
    // Tab 2 hydrates DD2380 as it stands.
    writeFresh({ DD2380: draftWith({ message: "First pass" }) });
    const hydrated = readDrafts(ME);

    // Tab 1 gets further with the same course.
    writeDrafts(
      { ...hydrated, DD2380: draftWith({ message: "Second pass" }) },
      hydrated,
      ME,
    );

    // Tab 2, which never touched DD2380 again, saves a different course.
    writeDrafts({ ...hydrated, SF1626: draftWith() }, hydrated, ME);

    expect(readDrafts(ME).DD2380?.message).toBe("Second pass");
    expect(readDrafts(ME).SF1626?.message).toBe("Half a thought");
  });

  it("still writes a course it did change since it synchronised", () => {
    writeFresh({ DD2380: draftWith({ message: "First pass" }) });
    const hydrated = readDrafts(ME);

    writeDrafts({ DD2380: draftWith({ message: "Mine now" }) }, hydrated, ME);

    expect(readDrafts(ME).DD2380?.message).toBe("Mine now");
  });

  /*
   * `localStorage` is shared between tabs, which is the point — and the hazard.
   * A pane rewriting its whole record used to be exactly right, because the
   * record *was* the tab's storage. Now a second tab writing its own record
   * must not take the first tab's work with it.
   */
  it("leaves a draft it has never heard of where another tab put it", () => {
    writeFresh({ SF1626: draftWith({ message: "Written next door" }) });

    writeFresh({ DD2380: draftWith() });

    expect(readDrafts(ME).SF1626?.message).toBe("Written next door");
    expect(readDrafts(ME).DD2380?.message).toBe("Half a thought");
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

    expect(readDrafts(ME)).toEqual({});
    expect(() => writeFresh({ DD2380: draftWith() })).not.toThrow();

    getItem.mockRestore();
    setItem.mockRestore();
  });
});

/*
 * Shipping this change must not be the data loss it fixes. The release it
 * replaces wrote `{ [courseCode]: ReviewDraft }` under the same key in the
 * tab's `sessionStorage`; a student with a half-written review open at deploy
 * time still has it, in the place the new code no longer looks.
 */
describe("drafts the previous release left behind", () => {
  const LEGACY = { DD2380: { ...EMPTY_REVIEW_DRAFT, message: "From before" } };

  it("brings a legacy draft across, once, and drops the old key", () => {
    sessionStorage.setItem(DRAFTS_KEY, JSON.stringify(LEGACY));

    expect(readDrafts(ME).DD2380?.message).toBe("From before");
    expect(sessionStorage.getItem(DRAFTS_KEY)).toBeNull();
    expect(storedDrafts(ANON).DD2380.savedAt).toBeTypeOf("number");
    // And it is genuinely in the new home now, not read from the old one again.
    expect(readDrafts(ME).DD2380?.message).toBe("From before");
  });

  // A draft written since the deploy is the current one; the copy an old tab
  // left behind must not replace it.
  it("lets a draft written since the deploy win", () => {
    writeFresh({ DD2380: draftWith({ message: "Written since" }) });
    sessionStorage.setItem(DRAFTS_KEY, JSON.stringify(LEGACY));

    expect(readDrafts(ME).DD2380?.message).toBe("Written since");
  });

  // The old build stored cleared drafts; this one does not. Carrying one across
  // would put back an entry the student had emptied.
  it("does not resurrect a legacy draft that was already empty", () => {
    sessionStorage.setItem(
      DRAFTS_KEY,
      JSON.stringify({ DD2380: EMPTY_REVIEW_DRAFT }),
    );

    expect(readDrafts(ME)).toEqual({});
  });

  // Losing the legacy key before the new one is safely written would be the
  // migration losing the draft it exists to save.
  it("keeps the old key when the new one cannot be written", () => {
    sessionStorage.setItem(DRAFTS_KEY, JSON.stringify(LEGACY));
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota exceeded");
      });

    expect(readDrafts(ME).DD2380?.message).toBe("From before");

    setItem.mockRestore();
    expect(sessionStorage.getItem(DRAFTS_KEY)).not.toBeNull();
  });
});

/*
 * A decoder that rejects is a decoder that deletes, because the pane writes its
 * state straight back over storage. So a stored draft that is wrong in one
 * field has to come back missing that field and nothing else.
 *
 * The rules themselves belong to `features/reviews/lib/review-draft.ts` now —
 * this file used to hold its own copy of them and `reviewer-session.ts` a
 * third, which is #166. These stay because what is asserted here is that *this
 * storage path* still salvages: the shared decoder having the right policy is
 * no use if a future read stops going through it.
 */
describe("a stored draft that does not quite fit", () => {
  it("keeps the write-up and the scores when the examination split is broken", () => {
    storeRawDraft("DD2380", {
      ...draftWith({ workloadScore: 8, happyTook: true }),
      methods: ["exam", "labs"],
      shares: [60],
    });

    const draft = readDrafts(ME).DD2380;
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

    expect(readDrafts(ME).DD2380?.methods).toEqual([]);
    expect(readDrafts(ME).DD2380?.message).toBe("Half a thought");
  });

  it("drops a split that does not add up to 100", () => {
    storeRawDraft("DD2380", {
      ...draftWith(),
      methods: ["exam", "labs"],
      shares: [60, 30],
    });

    expect(readDrafts(ME).DD2380?.methods).toEqual([]);
  });

  it("keeps a split that is entirely fine", () => {
    storeRawDraft("DD2380", {
      ...draftWith(),
      methods: ["exam", "labs"],
      shares: [60, 40],
    });

    expect(readDrafts(ME).DD2380?.methods).toEqual(["exam", "labs"]);
    expect(readDrafts(ME).DD2380?.shares).toEqual([60, 40]);
  });

  it("ignores an entry that is not a draft at all", () => {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify({ DD2380: "nope" }));

    expect(readDrafts(ME)).toEqual({});
  });

  it("ignores an entry with no stamp, which no build of this ever wrote", () => {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify({ DD2380: draftWith() }));

    expect(readDrafts(ME)).toEqual({});
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

/*
 * `localStorage` is the browser's, not the account's. Before drafts were keyed
 * by owner, signing out and signing in as somebody else on the same browser
 * profile handed the second account the first one's unpublished review — which
 * they could then edit and publish under their own name.
 */
describe("drafts belong to the account that wrote them", () => {
  it("does not hand one account's draft to the next", () => {
    writeFresh({ DD2380: draftWith({ message: "Mine alone" }) }, ME);

    expect(readDrafts(OTHER)).toEqual({});
  });

  it("keeps two accounts' drafts for the same course apart", () => {
    writeFresh({ DD2380: draftWith({ message: "Mine" }) }, ME);
    writeFresh({ DD2380: draftWith({ message: "Theirs" }) }, OTHER);

    expect(readDrafts(ME).DD2380?.message).toBe("Mine");
    expect(readDrafts(OTHER).DD2380?.message).toBe("Theirs");
  });

  it("leaves another account's bucket alone when it writes", () => {
    writeFresh({ SF1626: draftWith({ message: "Next door" }) }, OTHER);

    writeFresh({ DD2380: draftWith() }, ME);

    expect(readDrafts(OTHER).SF1626?.message).toBe("Next door");
    expect(readDrafts(ME).SF1626).toBeUndefined();
  });

  // The whole reason drafts are in `localStorage`: the magic link opens a new
  // tab, so a draft begun signed-out has to survive into the session.
  it("carries a draft begun signed-out into the account that signs in", () => {
    writeFresh({ DD2380: draftWith({ message: "Before signing in" }) }, ANON);

    expect(readDrafts(ME).DD2380?.message).toBe("Before signing in");
  });

  it("moves the anonymous draft rather than copying it", () => {
    writeFresh({ DD2380: draftWith({ message: "Before signing in" }) }, ANON);

    writeFresh(readDrafts(ME), ME);

    expect(readDrafts(ME).DD2380?.message).toBe("Before signing in");
    expect(storedDrafts(ANON)).toEqual({});
    expect(readDrafts(OTHER)).toEqual({});
  });

  it("prefers an account's own draft to one it would inherit", () => {
    writeFresh({ DD2380: draftWith({ message: "Anonymous" }) }, ANON);
    writeFresh({ DD2380: draftWith({ message: "Signed in" }) }, ME);

    expect(readDrafts(ME).DD2380?.message).toBe("Signed in");
  });

  // Shipping the fix must not drop what the unowned release stored. No owner
  // was recorded to restore, so the first account to read it claims it.
  it("treats the previous release's unowned record as anonymous", () => {
    localStorage.setItem(
      DRAFTS_KEY,
      JSON.stringify({
        DD2380: {
          savedAt: Date.now(),
          draft: { ...EMPTY_REVIEW_DRAFT, message: "Unowned" },
        },
      }),
    );

    expect(readDrafts(ME).DD2380?.message).toBe("Unowned");
  });
});
