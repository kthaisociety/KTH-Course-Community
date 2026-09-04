import { extractText } from "unpdf";
import { TranscriptParseError } from "./parse";

/**
 * Pulls the text layer out of a transcript PDF.
 *
 * This is the only impure part of transcript import: everything downstream is a
 * pure function over the string it returns. The bytes stay in memory for the
 * length of one request — a transcript is a student's academic record and is
 * never written to disk, to blob storage, or to a log.
 *
 * The underlying error is deliberately dropped rather than chained: a PDF
 * library's failure message can quote bytes from the document, and nothing from
 * inside the file may reach a log line or an API response.
 */
export async function extractTranscriptText(
  bytes: Uint8Array,
): Promise<string> {
  try {
    const { text } = await extractText(bytes, { mergePages: true });
    return text;
  } catch {
    throw new TranscriptParseError(
      "This file could not be read. Upload the PDF that Ladok generates, " +
        "not a scan or a screenshot of it.",
    );
  }
}
