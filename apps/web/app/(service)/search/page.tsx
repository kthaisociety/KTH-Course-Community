import { Suspense } from "react";
import { Search } from "@/features/search/components/search";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Search />
    </Suspense>
  );
}
