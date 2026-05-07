import { webBucket, userAssetsBucket, skillBucket, kitBucket, kitCdn } from "./storage";
import { mcpRouter, userKitDbs, kitLambdaInfra } from "./mcp";
import * as secrets from "./secrets";

export const web = new sst.aws.Nextjs("Web", {
  path: "web",
  // Custom build: after OpenNext builds, fix the standalone path for monorepo.
  // outputFileTracingRoot points to monorepo root, so standalone output nests
  // under .next/standalone/web/ — OpenNext expects it at .next/standalone/.next/
  buildCommand: [
    "npx --yes @opennextjs/aws@3.9.14 build",
    "&&",
    "if [ -d .next/standalone/web/.next ] && [ ! -d .next/standalone/.next ]; then",
    "ln -s web/.next .next/standalone/.next;",
    "ln -s web/node_modules .next/standalone/node_modules 2>/dev/null || true;",
    "fi",
  ].join(" "),
  permissions: [
    {
      actions: ["lambda:*"],
      resources: [
        "arn:aws:lambda:*:*:function:Kit-*",
        "arn:aws:lambda:*:*:layer:KitRuntime:*",
      ],
    },
    {
      actions: ["iam:PassRole"],
      resources: ["arn:aws:iam::*:role/KitLambdaRole-*"],
    },
  ],
  server: {
    architecture: "arm64",
    install: [
      "@aws-sdk/client-s3",
      "@aws-sdk/s3-request-presigner",
      "@aws-sdk/client-dynamodb",
      "@aws-sdk/util-dynamodb",
      "@aws-sdk/client-lambda",
      "@aws-sdk/client-cloudwatch-logs",
    ],
  },
  link: [
    webBucket,
    userAssetsBucket,
    skillBucket,
    kitBucket,
    kitCdn,
    kitLambdaInfra,
    mcpRouter,
    userKitDbs,
    ...Object.values(secrets),
  ],
  environment: {
    USER_KIT_DBS_TABLE: userKitDbs.name,
    NEXT_PUBLIC_BETTER_AUTH_URL: $app.stage != "production" ? "http://localhost:3000" : "https://kitstack.co",
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY || "",
    NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com",
  },
  domain: $app.stage != "production" ? undefined : {
    name: "kitstack.co",
    redirects: ["www.kitstack.co"],
  },
});
