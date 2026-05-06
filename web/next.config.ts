import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";
import { resolve } from "path";

const withMDX = createMDX();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // Monorepo root — so Next.js traces hoisted deps from root node_modules
  outputFileTracingRoot: resolve(__dirname, ".."),
  outputFileTracingExcludes: {
    "*": [
      "./node_modules/libsql/**",
      "./node_modules/@libsql/linux-*/**",
      "./node_modules/@libsql/darwin-*/**",
      "./node_modules/@libsql/win32-*/**",
    ],
  },
  transpilePackages: ["@kitstackco/mcp-server", "@kitstackco/authz"],
  serverExternalPackages: [
    "sst",
    "@aws-sdk/client-s3",
    "@aws-sdk/s3-request-presigner",
    "@aws-sdk/client-dynamodb",
    "@aws-sdk/util-dynamodb",
  ],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push(
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
