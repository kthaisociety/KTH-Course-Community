import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ courseCode: string }>;
  searchParams: Promise<{
    writeReview?: string | string[];
  }>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The course page, which no longer exists.
 *
 * #68 §5 retired it: every course opens as a tab in the workspace pane, and
 * Explore is the pane's public host. This route stays behind as a redirect
 * because the URL was live — it is in browser histories, in shared links and in
 * whatever anyone bookmarked — and `?writeReview=1` came with it, so the two
 * ways in map onto the pane's two kinds of tab rather than collapsing into one.
 *
 * `openCourseRequest` in `features/workspace/lib/open-courses.ts` is what reads
 * the pair back off `/search`, and it upper-cases the code, so nothing is
 * normalised here.
 */
export default async function Page({ params, searchParams }: PageProps) {
  const { courseCode } = await params;
  const query = await searchParams;
  const kind = first(query.writeReview) === "1" ? "review" : "details";
  redirect(`/search?open=${encodeURIComponent(courseCode)}&kind=${kind}`);
}
