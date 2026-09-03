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
};

export default nextConfig;
