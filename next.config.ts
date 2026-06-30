import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.vip-box.fr",
      },
    ],
  },
};

export default nextConfig;
