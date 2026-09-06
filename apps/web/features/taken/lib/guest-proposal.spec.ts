/**
 * @vitest-environment jsdom
 *
 * `features/ ** /lib/` is the `logic` project, which runs in Node. The subject
 * of this module is `window.localStorage`, so it asks for one file's worth of
 * DOM rather than moving somewhere it does not belong — the same note
 * `features/saved/lib/guest-saves.spec.ts` makes for the same reason.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TranscriptProposal } from "@/server/ingest/transcript/service";
import {
  clearGuestProposal,
  forStorage,
  GUEST_PROPOSAL_TTL_MS,
  parseHandoff,
  readGuestProposal,
  withHandoff,
  writeGuestProposal,
} from "./guest-proposal";

const KEY = "kth-cc:taken-proposal";

/** The token a hand-written fixture is stored under, and read back with. */
const HANDOFF = "handoff-1";

function proposal(
  overrides: Partial<TranscriptProposal> = {},
): TranscriptProposal {
  return {
    candidates: [
      {
        courseCode: "DD1337",
        transcriptName: "Programmering",
        catalogueName: "Programming",
        grade: "B",
        earnedCredits: 7.5,
        attendanceYear: 2025,
      },
    ],
    unmatched: [],
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe("holding a proposal across a sign-in", () => {
  it("gives back the rows it was handed", () => {
    const handoff = writeGuestProposal(proposal(), true);

    expect(readGuestProposal(handoff)).toEqual({
      includeGrades: true,
      proposal: proposal(),
    });
  });

  it("says nothing when nothing is waiting", () => {
    expect(readGuestProposal(HANDOFF)).toBeNull();
  });

  it("forgets on request", () => {
    const handoff = writeGuestProposal(proposal(), true);
    clearGuestProposal();

    expect(readGuestProposal(handoff)).toBeNull();
  });

  /**
   * The grades switch off means "no grade of yours is stored anywhere"
   * (`docs/design_ref/2026-09-06/Course Community - Taken Courses.dc.html:1296`),
   * and `planTranscriptImport` drops them at confirm time anyway. Writing them
   * down for the sake of data the confirm will discard would make that copy
   * false for the one storage the reader cannot see.
   */
  it("keeps no grade when the reader turned grades off", () => {
    const handoff = writeGuestProposal(proposal(), false);

    expect(readGuestProposal(handoff)?.proposal.candidates[0].grade).toBeNull();
    expect(localStorage.getItem(KEY)).not.toContain('"B"');
  });

  it("keeps the grade when the reader turned grades on", () => {
    const handoff = writeGuestProposal(proposal(), true);

    expect(readGuestProposal(handoff)?.proposal.candidates[0].grade).toBe("B");
  });

  /**
   * The read applies the same filter the write did. A record from an older
   * build, or one edited in the console, cannot hand a grade to a reader who
   * turned grades off.
   */
  it("re-applies the grade rule on the way out", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        savedAt: Date.now(),
        handoff: HANDOFF,
        includeGrades: false,
        proposal: proposal(),
      }),
    );

    expect(readGuestProposal(HANDOFF)?.proposal.candidates[0].grade).toBeNull();
  });

  it("carries the course codes the catalogue does not have", () => {
    const handoff = writeGuestProposal(
      proposal({ unmatched: [{ courseCode: "XX9999", courseName: "Other" }] }),
      true,
    );

    expect(readGuestProposal(handoff)?.proposal.unmatched).toEqual([
      { courseCode: "XX9999", courseName: "Other" },
    ]);
  });
});

describe("a record that cannot be trusted", () => {
  it("expires, so a transcript read on a shared machine does not linger", () => {
    const handoff = writeGuestProposal(proposal(), true);
    vi.setSystemTime(Date.now() + GUEST_PROPOSAL_TTL_MS + 1);

    expect(readGuestProposal(handoff)).toBeNull();
  });

  it("survives right up to the expiry", () => {
    const handoff = writeGuestProposal(proposal(), true);
    vi.setSystemTime(Date.now() + GUEST_PROPOSAL_TTL_MS);

    expect(readGuestProposal(handoff)).not.toBeNull();
  });

  it.each([
    ["not JSON", "{"],
    ["not an object", '"a string"'],
    ["undated", JSON.stringify({ handoff: HANDOFF, proposal: proposal() })],
    [
      "holding no proposal",
      JSON.stringify({ savedAt: Date.now(), handoff: HANDOFF }),
    ],
    [
      "holding no rows",
      JSON.stringify({
        savedAt: Date.now(),
        handoff: HANDOFF,
        proposal: { candidates: [], unmatched: [] },
      }),
    ],
    [
      "holding rows with no course code",
      JSON.stringify({
        savedAt: Date.now(),
        handoff: HANDOFF,
        proposal: { candidates: [{ catalogueName: "Programming" }] },
      }),
    ],
  ])("is dropped when it is %s", (_what, raw) => {
    localStorage.setItem(KEY, raw);

    expect(readGuestProposal(HANDOFF)).toBeNull();
  });

  /**
   * Salvaged field by field rather than refused whole: a row's course code is
   * the one field a confirm cannot do without — `user_taken_courses.course_code`
   * is a foreign key to `courses.code` — and everything else on it is
   * self-reported and allowed to be missing.
   */
  it("salvages a row that has a course code and little else", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        savedAt: Date.now(),
        handoff: HANDOFF,
        includeGrades: true,
        proposal: { candidates: [{ courseCode: "DD1337", grade: 7 }] },
      }),
    );

    expect(readGuestProposal(HANDOFF)?.proposal.candidates).toEqual([
      {
        courseCode: "DD1337",
        transcriptName: "DD1337",
        catalogueName: "DD1337",
        grade: null,
        earnedCredits: null,
        attendanceYear: null,
      },
    ]);
  });
});

describe("the storage rule on its own", () => {
  it("is pure: it returns a new proposal rather than editing one", () => {
    const original = proposal();
    const stripped = forStorage(original, false);

    expect(original.candidates[0].grade).toBe("B");
    expect(stripped.candidates[0].grade).toBeNull();
  });
});

/**
 * The handoff token, which is what stops one reader being handed another's
 * transcript on a shared browser. `taken-courses.spec.tsx` mounts the whole
 * screen against the same rule; these are the rule itself.
 */
describe("claimable only by the sign-in it was written for", () => {
  it("mints a different token for every proposal it stores", () => {
    const first = writeGuestProposal(proposal(), true);
    const second = writeGuestProposal(proposal(), true);

    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(second).not.toBe(first);
  });

  it("refuses a token that does not match the record", () => {
    writeGuestProposal(proposal(), true);

    expect(readGuestProposal("some-other-token")).toBeNull();
  });

  /**
   * The case the whole scheme exists for: a second person at the same browser
   * opens `/taken` with no token at all. They get nothing, whether or not they
   * are signed in — the component cannot even ask on their behalf.
   */
  it.each([
    ["no token", null],
    ["an empty token", ""],
  ])("fails closed given %s", (_what, token) => {
    writeGuestProposal(proposal(), true);

    expect(readGuestProposal(token)).toBeNull();
  });

  /**
   * A record written before this token existed has no `handoff`, so it matches
   * nothing and is dropped rather than handed to the first reader who asks.
   */
  it("drops a record from a build that had no token", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        savedAt: Date.now(),
        includeGrades: true,
        proposal: proposal(),
      }),
    );

    expect(readGuestProposal(HANDOFF)).toBeNull();
    expect(readGuestProposal(null)).toBeNull();
  });

  it("still refuses the right token once the record is expired", () => {
    const handoff = writeGuestProposal(proposal(), true);
    vi.setSystemTime(Date.now() + GUEST_PROPOSAL_TTL_MS + 1);

    expect(readGuestProposal(handoff)).toBeNull();
  });
});

/** Carrying the token through the sign-in round trip, in the URL. */
describe("the handoff parameter", () => {
  it("puts the token on a plain path", () => {
    expect(withHandoff("/taken", "abc")).toBe("/taken?resume=abc");
  });

  it("keeps a query the path already had", () => {
    expect(withHandoff("/taken?review=1", "abc")).toBe(
      "/taken?review=1&resume=abc",
    );
  });

  it("replaces rather than repeats a token already there", () => {
    expect(withHandoff("/taken?resume=old", "new")).toBe("/taken?resume=new");
  });

  it("escapes a token that would otherwise punctuate the query", () => {
    expect(
      parseHandoff(new URL(withHandoff("/taken", "a&b=c"), "https://x").search),
    ).toBe("a&b=c");
  });

  it.each([
    ["nothing", ""],
    ["another parameter", "?review=1"],
    ["an empty token", "?resume="],
  ])("reads no token from %s", (_what, search) => {
    expect(parseHandoff(search)).toBeNull();
  });

  it("round-trips what it wrote", () => {
    const handoff = writeGuestProposal(proposal(), true);
    const search = withHandoff("/taken", handoff ?? "").slice("/taken".length);

    expect(readGuestProposal(parseHandoff(search))).not.toBeNull();
  });
});
