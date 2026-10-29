import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Optional separate build folder (lets a production build coexist with `next dev`)
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.fbcdn.net" },
      { protocol: "https", hostname: "**.facebook.com" },
    ],
  },
};

export default nextConfig;
