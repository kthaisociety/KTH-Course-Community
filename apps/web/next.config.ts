import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../..",
  ),
  images: {
    remotePatterns: [{ hostname: "lh3.googleusercontent.com" }],
  },
  /**
   * Routes that have been renamed, and the links already out in the world that
   * point at their old names.
   *
   * `/favorites` was the Saved courses page until #90 moved it to `/saved`,
   * closing the last of the three names ADR 0003 recorded for one concept.
   * Bookmarks, history entries and anything anyone has shared still say
   * `/favorites`, and without an entry here they land on the 404 page.
   *
   * `permanent` is a 308, which is what a rename is: the old path is not coming
   * back, and `CONTEXT.md` retires the word rather than freeing it for reuse.
   * Next carries the query string across on its own, so `?from=…` survives.
   *
   * This lives here rather than as a `favorites/page.tsx` calling `redirect()`
   * so the app has no `favorites` route to render — one line of configuration
   * instead of a directory named after a retired word.
   */
  async redirects() {
    return [{ source: "/favorites", destination: "/saved", permanent: true }];
  },
};

export default nextConfig;
