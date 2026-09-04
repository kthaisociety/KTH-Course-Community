import { Suspense } from "react";
import { Landing } from "@/features/landing/components/landing";

export default function Home() {
  return (
    // The private link comes back with its outcome in the query string, which
    // the page reads on the client.
    <Suspense fallback={null}>
      <Landing />
    </Suspense>
  );
}
