export type ParsedCourse = {
  courseCode: string;
  grade: string | null;
  credits: number | null;
};

const COURSE_CODE_RE = /\b([A-Z]{2,3}\d{4})\b/;
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

    const gradeMatch = GRADE_RE.exec(block);
    const creditsMatch = CREDITS_RE.exec(block);
    const credits = creditsMatch
      ? Number.parseFloat(creditsMatch[1].replace(",", "."))
      : 0;

    results.push({
      courseCode,
      grade: gradeMatch?.[1] ?? null,
      credits,
    });
  }

  return results;
}
