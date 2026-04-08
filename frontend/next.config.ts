import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [{ hostname: "lh3.googleusercontent.com" }],
  },
  serverExternalPackages: ["supertokens-node"],
};

export default nextConfig;
