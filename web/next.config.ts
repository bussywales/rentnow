import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
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
  },
  async redirects() {
    return [
      {
        // Do not remove; protects auth cookies across hostnames.
        source:
          "/:path((?!api|_next|favicon.ico|robots.txt|sitemap.xml).*)",
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
