import type { NextConfig } from "next";

process.env.BROWSERSLIST_IGNORE_OLD_DATA ??= "true";
process.env.BASELINE_BROWSER_MAPPING_IGNORE_OLD_DATA ??= "true";

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
            value: "propatyhub.com",
          },
        ],
        destination: "https://www.propatyhub.com/:path*",
        permanent: true,
      },
    ];
  },
  outputFileTracingIncludes: {
    "app/api/legal/documents/[id]/export/route": [
      "./node_modules/pdfkit/js/data/**",
    ],
    "app/api/admin/legal/documents/[id]/export/route": [
      "./node_modules/pdfkit/js/data/**",
    ],
  },
};

export default nextConfig;
