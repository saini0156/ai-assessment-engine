import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    // Keep optimized images cached for 30 days (the default is only 60 seconds)
    minimumCacheTTL: 60 * 60 * 24 * 30,
    // Qualities used in the code (required from Next.js 16)
    qualities: [65, 70, 75],
  },
};

export default nextConfig;