import { Saved } from "@/features/saved/components/saved";

/**
 * `?collection=<id>` names the collection whose detail is open in the page's
 * Collections section, so a refresh or a shared link lands back on it. The
 * artboard reaches collections only from here, so the permalink is this route's
 * rather than `/collections`'.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ collection?: string }>;
}) {
  const { collection } = await searchParams;
  return <Saved openCollectionId={collection ?? null} />;
}
