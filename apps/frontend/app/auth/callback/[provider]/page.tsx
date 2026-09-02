import OAuthCallbackController from "@/controllers/OAuthCallbackController";

type Props = {
  params: Promise<{ provider: string }>;
};

/** Next.js 16+: `params` is a Promise and must be awaited for dynamic segments. */
export default async function OAuthCallbackPage({ params }: Props) {
  await params;
  return <OAuthCallbackController />;
}
