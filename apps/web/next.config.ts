import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // `unpdf` bundles pdf.js and is loaded by path from a worker thread, not by
  // an import the bundler can follow. Keeping it external leaves it a real
  // package in node_modules for that worker to resolve at runtime.
  serverExternalPackages: ["unpdf"],
  // That same indirection hides it from file tracing, which only follows
  // static imports — without this the standalone build ships a transcript
  // route whose worker has nothing to load.
  outputFileTracingIncludes: {
    "/api/user/transcript": ["../../node_modules/unpdf/**/*"],
  },
  outputFileTracingRoot: path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../..",
  ),
  images: {
    remotePatterns: [{ hostname: "lh3.googleusercontent.com" }],
  },
};

export default nextConfig;
