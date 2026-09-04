import { describe, expect, it } from "vitest";
import { TranscriptParseError } from "./parse";
import { extractTranscriptText } from "./pdf-text";

/**
 * A syntactically valid PDF of `pages` text pages.
 *
 * Real transcripts cannot be committed — they are academic records carrying a
 * personal identity number — so the tests that need real PDF bytes build their
 * own. Page count is the dial: it buys parsing work without needing a
 * maliciously crafted file.
 */
function textPdf(pages: number, linesPerPage = 45): Uint8Array {
  const objects: string[] = [
    "<</Type/Catalog/Pages 2 0 R>>",
    `<</Type/Pages/Kids[${Array.from(
      { length: pages },
      (_, p) => `${4 + p * 2} 0 R`,
    ).join(" ")}]/Count ${pages}>>`,
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
  ];

  for (let p = 0; p < pages; p++) {
    let content = "BT /F1 9 Tf 40 750 Td 11 TL\n";
    for (let line = 0; line < linesPerPage; line++) {
      content += `(DD${1000 + line} Kursnamn ${p}-${line} 7,5 hp A 2024-01-15) Tj T*\n`;
    }
    content += "ET";
    objects.push(
      "<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]" +
        `/Resources<</Font<</F1 3 0 R>>>>/Contents ${5 + p * 2} 0 R>>`,
      `<</Length ${content.length}>>\nstream\n${content}\nendstream`,
    );
  }

  let pdf = "%PDF-1.7\n";
  const offsets: number[] = [];
  for (const [index, body] of objects.entries()) {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\n`;
  pdf += `startxref\n${xref}\n%%EOF\n`;

  return new TextEncoder().encode(pdf);
}

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

  it("reads the text of a PDF it can parse", async () => {
    const text = await extractTranscriptText(textPdf(2));

    expect(text).toContain("DD1000 Kursnamn 0-0 7,5 hp A 2024-01-15");
    expect(text).toContain("DD1000 Kursnamn 1-0 7,5 hp A 2024-01-15");
  });

  it("rejects a document that runs past the CPU budget", async () => {
    // Deliberately heavier than the 4MB the route admits: the size cap is a
    // separate, earlier layer, and what is under test here is the budget. The
    // page count buys enough parsing work that the outcome cannot turn on how
    // fast the machine running the test is.
    const heavy = textPdf(3000);

    await expect(
      extractTranscriptText(heavy, { budgetMs: 1000 }),
    ).rejects.toBeInstanceOf(TranscriptParseError);
  }, 30_000);

  it("gives up at the budget instead of finishing the parse", async () => {
    const heavy = textPdf(3000);

    const startedAt = performance.now();
    await expect(
      extractTranscriptText(heavy, { budgetMs: 1000 }),
    ).rejects.toThrow();
    const elapsed = performance.now() - startedAt;

    // Parsing this document to completion takes ~3.5s on the development
    // machine. Returning inside 2.5s is only possible if the parse was cut
    // short rather than waited out.
    expect(elapsed).toBeLessThan(2_500);
  }, 30_000);
});
