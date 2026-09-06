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
  readGuestProposal,
  writeGuestProposal,
} from "./guest-proposal";

const KEY = "kth-cc:taken-proposal";

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
    writeGuestProposal(proposal(), true);

    expect(readGuestProposal()).toEqual({
      includeGrades: true,
      proposal: proposal(),
    });
  });

  it("says nothing when nothing is waiting", () => {
    expect(readGuestProposal()).toBeNull();
  });

  it("forgets on request", () => {
    writeGuestProposal(proposal(), true);
    clearGuestProposal();

    expect(readGuestProposal()).toBeNull();
  });

  /**
   * The grades switch off means "no grade of yours is stored anywhere"
   * (`docs/design_ref/2026-09-06/Course Community - Taken Courses.dc.html:1296`),
   * and `planTranscriptImport` drops them at confirm time anyway. Writing them
   * down for the sake of data the confirm will discard would make that copy
   * false for the one storage the reader cannot see.
   */
  it("keeps no grade when the reader turned grades off", () => {
    writeGuestProposal(proposal(), false);

    expect(readGuestProposal()?.proposal.candidates[0].grade).toBeNull();
    expect(localStorage.getItem(KEY)).not.toContain('"B"');
  });

  it("keeps the grade when the reader turned grades on", () => {
    writeGuestProposal(proposal(), true);

    expect(readGuestProposal()?.proposal.candidates[0].grade).toBe("B");
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
        includeGrades: false,
        proposal: proposal(),
      }),
    );

    expect(readGuestProposal()?.proposal.candidates[0].grade).toBeNull();
  });

  it("carries the course codes the catalogue does not have", () => {
    writeGuestProposal(
      proposal({ unmatched: [{ courseCode: "XX9999", courseName: "Other" }] }),
      true,
    );

    expect(readGuestProposal()?.proposal.unmatched).toEqual([
      { courseCode: "XX9999", courseName: "Other" },
    ]);
  });
});

describe("a record that cannot be trusted", () => {
  it("expires, so a transcript read on a shared machine does not linger", () => {
    writeGuestProposal(proposal(), true);
    vi.setSystemTime(Date.now() + GUEST_PROPOSAL_TTL_MS + 1);

    expect(readGuestProposal()).toBeNull();
  });

  it("survives right up to the expiry", () => {
    writeGuestProposal(proposal(), true);
    vi.setSystemTime(Date.now() + GUEST_PROPOSAL_TTL_MS);

    expect(readGuestProposal()).not.toBeNull();
  });

  it.each([
    ["not JSON", "{"],
    ["not an object", '"a string"'],
    ["undated", JSON.stringify({ proposal: proposal() })],
    ["holding no proposal", JSON.stringify({ savedAt: Date.now() })],
    [
      "holding no rows",
      JSON.stringify({
        savedAt: Date.now(),
        proposal: { candidates: [], unmatched: [] },
      }),
    ],
    [
      "holding rows with no course code",
      JSON.stringify({
        savedAt: Date.now(),
        proposal: { candidates: [{ catalogueName: "Programming" }] },
      }),
    ],
  ])("is dropped when it is %s", (_what, raw) => {
    localStorage.setItem(KEY, raw);

    expect(readGuestProposal()).toBeNull();
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
        includeGrades: true,
        proposal: { candidates: [{ courseCode: "DD1337", grade: 7 }] },
      }),
    );

    expect(readGuestProposal()?.proposal.candidates).toEqual([
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
