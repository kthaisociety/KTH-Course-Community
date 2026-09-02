import { Suspense } from "react";
import SearchController from "../../../controllers/SearchController";
import SuspenseView from "../../../views/SuspenseView";

export default function Page() {
  // SearchController reads ?selected= via useSearchParams(), which bails out of
  // static prerendering unless it sits under a Suspense boundary.
  return (
    <Suspense fallback={<SuspenseView />}>
      <SearchController />
    </Suspense>
  );
}
