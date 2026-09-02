/** Official KTH student course page (course plan / course memo on kth.se). */
export function kthCourseUrl(courseCode: string): string {
  const code = courseCode.trim();
  return `https://www.kth.se/student/kurser/kurs/${encodeURIComponent(code)}`;
}
