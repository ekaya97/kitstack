import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";
import { resolve } from "path";

const withMDX = createMDX();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // Monorepo root — so Next.js traces hoisted deps from root node_modules
  outputFileTracingRoot: resolve(__dirname, ".."),
  serverExternalPackages: [
    "sst",
    "@libsql/client",
    "libsql",
    "@aws-sdk/client-s3",
    "@aws-sdk/s3-request-presigner",
  ],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push(
        /^@libsql\/.*/,
        /^libsql$/,
        /^@aws-sdk\/.*/,
        /^@smithy\/.*/,
      );
    }
    return config;
  },
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

export default withMDX(nextConfig);
