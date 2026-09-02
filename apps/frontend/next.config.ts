import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const backendDomain =
  process.env.BACKEND_DOMAIN || process.env.NEXT_PUBLIC_BACKEND_DOMAIN;

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../..",
  ),
  images: {
    remotePatterns: [{ hostname: "lh3.googleusercontent.com" }],
  },
  async rewrites() {
    if (!backendDomain) return [];

    const base = backendDomain.replace(/\/$/, "");

    return [
      {
        source: "/api/auth/:path*",
        destination: `${base}/auth/:path*`,
      },
      {
        source: "/api/nest/:path*",
        destination: `${base}/:path*`,
      },
    ];
  },
};

export default nextConfig;
