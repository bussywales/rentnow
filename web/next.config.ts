import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
    // Temporary: bypass Next optimizer while Unsplash 404s are investigated.
    unoptimized: true,
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "rentnow.space",
          },
        ],
        destination: "https://www.rentnow.space/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
