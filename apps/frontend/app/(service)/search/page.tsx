import { Suspense } from "react";
import SearchController from "../../../controllers/SearchController";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SearchController />
    </Suspense>
  );
}
