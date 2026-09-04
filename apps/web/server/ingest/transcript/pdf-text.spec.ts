import { describe, expect, it } from "vitest";
import { TranscriptParseError } from "./parse";
import { extractTranscriptText } from "./pdf-text";

describe("extractTranscriptText", () => {
  it("rejects bytes that are not a PDF", async () => {
    const notAPdf = new TextEncoder().encode("just some text, not a PDF");

    await expect(extractTranscriptText(notAPdf)).rejects.toBeInstanceOf(
      TranscriptParseError,
    );
  });

  it("rejects a truncated PDF without quoting it back", async () => {
    const truncated = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<< /Sec");

    await expect(extractTranscriptText(truncated)).rejects.toSatisfy(
      (error: Error) => !error.message.includes("Sec"),
    );
  });
});
