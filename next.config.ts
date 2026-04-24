import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["sst"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push("sst");
    }
    return config;
  },
  outputFileTracingRoot: __dirname,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.s3.amazonaws.com",
      },
    ],
  },
  rewrites: async () => [
    {
      source: "/ingest/static/:path*",
      destination: "https://eu-assets.i.posthog.com/static/:path*",
    },
    {
      source: "/ingest/:path*",
      destination: "https://eu.i.posthog.com/:path*",
    },
  ],
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
