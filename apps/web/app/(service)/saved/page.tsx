import { Saved } from "@/features/saved/components/saved";
import { openCourseRequest } from "@/features/workspace";

/**
 * `?collection=<id>` names the collection whose detail is open in the page's
 * Collections section, so a refresh or a shared link lands back on it. The
 * artboard reaches collections only from here, so the permalink is this route's
 * rather than `/collections`'.
 *
 * `?open=<code>&kind=details|review` is not a permalink but an instruction, and
 * the page spends it: a course opened from inside a collection detail comes back
 * through the route because the workspace pane it opens into is this page's.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ collection?: string; open?: string; kind?: string }>;
}) {
  const { collection, open, kind } = await searchParams;
  return (
    <Saved
      openCollectionId={collection ?? null}
      openCourse={openCourseRequest(open, kind)}
    />
  );
}
