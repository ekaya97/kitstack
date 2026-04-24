import { bucket } from "./storage";
import { mcpRouter, userKitDbs } from "./mcp";
import * as secrets from "./secrets";

export const web = new sst.aws.Nextjs("Web", {
  link: [
    bucket,
    mcpRouter,
    userKitDbs,
    ...Object.values(secrets),
  ],
  environment: {
    NEXT_PUBLIC_BETTER_AUTH_URL: $dev ? "http://localhost:3000" : "https://kitstack.co",
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY || "",
    NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com",
  },
  domain: $dev ? undefined : {
    name: "kitstack.co",
    redirects: ["www.kitstack.co"],
  },
});
