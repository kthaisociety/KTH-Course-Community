/** Official KTH student course page (course plan / course memo on kth.se). */
export function kthCourseUrl(courseCode: string): string {
  const code = courseCode.trim();
  return `https://www.kth.se/student/kurser/kurs/${encodeURIComponent(code)}`;
}

export function formatTerm(startTerm: number): string {
  const year = Math.floor(startTerm / 10);
  const half = startTerm % 10;
  const prefix = half === 1 ? "VT" : half === 2 ? "HT" : "";
  return prefix ? `${prefix}${String(year).slice(-2)}` : String(startTerm);
}

export function formatHp(credits: number | null): string {
  if (credits == null || !Number.isFinite(credits)) return "—";
  return Number.isInteger(credits) ? String(credits) : credits.toFixed(1);
}
