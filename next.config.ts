import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the development and production module manifests isolated. Running
  // `next dev` and `next build` against the same directory can leave the dev
  // server holding references to chunks that the build replaced.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "sleepercdn.com" },
      { protocol: "https", hostname: "a.espncdn.com" },
    ],
  },
};

export default nextConfig;
