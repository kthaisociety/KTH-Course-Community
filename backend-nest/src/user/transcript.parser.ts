export type ParsedCourse = {
  courseCode: string;
  grade: string | null;
  credits: number | null;
};

// Matches regular course codes (e.g. SF1624) and degree-project codes (e.g. DA231X)
const COURSE_CODE_RE = /\b([A-Z]{2,3}\d{4}|[A-Z]{2}\d{3}X)\b/;
// Fx must be checked before F to avoid partial match
const GRADE_RE = /\b(A|B|C|D|E|Fx|F|VG|G|P|U)\b/;
const CREDITS_RE = /(\d+[.,]\d+)\s*hp/i;

export function parseTranscript(text: string): ParsedCourse[] {
  const results: ParsedCourse[] = [];
  const seen = new Set<string>();
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const codeMatch = COURSE_CODE_RE.exec(line);
    if (!codeMatch) continue;

    const courseCode = codeMatch[1];
    if (seen.has(courseCode)) continue;
    seen.add(courseCode);

    const window = [line];
    for (let j = i + 1; j <= i + 3 && j < lines.length; j++) {
      if (COURSE_CODE_RE.test(lines[j])) break;
      window.push(lines[j]);
    }
    const block = window.join(" ");

    const creditsMatch = CREDITS_RE.exec(block);
    const credits = creditsMatch
      ? Number.parseFloat(creditsMatch[1].replace(",", "."))
      : null;

    // Ladok transcripts list the grade after the credits ("… 7,5 hp A"), so
    // search there first — otherwise standalone letters in course titles
    // ("English A") would be mistaken for grades. Fall back to the whole
    // block for layouts where the grade precedes the credits.
    let gradeMatch: RegExpExecArray | null = null;
    if (creditsMatch) {
      gradeMatch = GRADE_RE.exec(
        block.slice(creditsMatch.index + creditsMatch[0].length),
      );
    }
    if (!gradeMatch) {
      gradeMatch = GRADE_RE.exec(block);
    }

    results.push({
      courseCode,
      grade: gradeMatch?.[1] ?? null,
      credits,
    });
  }

  return results;
}
