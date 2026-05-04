import type { NextConfig } from "next";

const backendDomain =
  process.env.BACKEND_DOMAIN || process.env.NEXT_PUBLIC_BACKEND_DOMAIN;

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [{ hostname: "lh3.googleusercontent.com" }],
  },
  serverExternalPackages: ["supertokens-node"],
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
