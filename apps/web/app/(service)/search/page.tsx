import { Suspense } from "react";
import { Explore } from "@/features/search/components/explore";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Explore />
    </Suspense>
  );
}
