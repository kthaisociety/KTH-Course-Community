import { Suspense } from "react";
import { SearchScreen } from "@/features/search";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SearchScreen />
    </Suspense>
  );
}
