import { Suspense } from "react";
import SearchController from "../../../controllers/SearchController";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SearchController />
    </Suspense>
  );
}
