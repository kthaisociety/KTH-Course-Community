import { Collections } from "@/features/collections/components/collections";

/**
 * `?collection=<id>` names the open collection, so a refresh or a shared link
 * lands back on it. An id that is not one of the viewer's own reads as
 * not-found: ownership is scoped in the query, so a stranger's collection is
 * simply absent rather than refused.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ collection?: string }>;
}) {
  const { collection } = await searchParams;
  return <Collections openCollectionId={collection ?? null} />;
}
