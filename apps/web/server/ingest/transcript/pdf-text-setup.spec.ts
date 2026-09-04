import { beforeAll, describe, expect, it, vi } from "vitest";

// Worker construction is made to fail for every call in this file, which is why
// it is a file of its own: the point is what the capacity gate does when a
// parse never gets as far as running.
vi.mock("node:worker_threads", () => ({
  Worker: class {
    constructor() {
      throw new Error("worker could not be started");
    }
  },
}));

describe("extractTranscriptText when the parser cannot be started", () => {
  let extractTranscriptText: typeof import("./pdf-text").extractTranscriptText;
  let TranscriptBusyError: typeof import("./pdf-text").TranscriptBusyError;

  beforeAll(async () => {
    ({ extractTranscriptText, TranscriptBusyError } = await import(
      "./pdf-text"
    ));
  });

  it("hands the slot back so a failure does not cost capacity", async () => {
    const pdf = new TextEncoder().encode("%PDF-1.7\n");

    // Far more attempts than the two slots and eight queue places. If a failed
    // setup kept its slot, the gate would be exhausted after two and the rest
    // would come back as "busy" — which is the bug this pins.
    for (let attempt = 0; attempt < 25; attempt++) {
      await expect(extractTranscriptText(pdf)).rejects.not.toBeInstanceOf(
        TranscriptBusyError,
      );
    }
  }, 30_000);
});
