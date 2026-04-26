import { webBucket, skillBucket } from "./storage";
import { mcpRouter, userKitDbs } from "./mcp";
import * as secrets from "./secrets";

export const web = new sst.aws.Nextjs("Web", {
  path: "web",
  link: [
    webBucket,
    skillBucket,
    mcpRouter,
    userKitDbs,
    ...Object.values(secrets),
  ],
  environment: {
    NEXT_PUBLIC_BETTER_AUTH_URL: $app.stage != "production" ? "http://localhost:3000" : "https://kitstack.co",
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY || "",
    NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com",
  },
  domain: $app.stage != "production" ? undefined : {
    name: "kitstack.co",
    redirects: ["www.kitstack.co"],
  },
});
