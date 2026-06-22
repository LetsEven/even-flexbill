import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/manifest.json",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  runtimeCaching: [
    {
      urlPattern: /\.(?:mp4|webm)$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "static-video-assets",
        rangeRequests: true,
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 86400,
        },
      },
    },
  ],
};

export default nextConfig;
