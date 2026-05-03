import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const withMDX = createMDX();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  serverExternalPackages: [
    "sst",
    "@libsql/client",
    "libsql",
    "@aws-sdk/client-s3",
    "@aws-sdk/s3-request-presigner",
  ],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize native packages that can't be bundled by webpack.
      // serverExternalPackages only works for imports within web/,
      // but we also import from ../packages/mcp-server/ which
      // resolves @libsql from root node_modules.
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

export default withMDX(nextConfig);
