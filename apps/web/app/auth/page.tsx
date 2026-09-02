import { Auth } from "@/features/auth/components/auth";

type PageProps = {
  searchParams: Promise<{ error?: string | string[] }>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AuthPage({ searchParams }: PageProps) {
  const query = await searchParams;
  return <Auth error={first(query.error)} />;
}
