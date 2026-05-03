import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import { Resource } from "sst";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  secret: Resource.BetterAuthSecret.value,
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: Resource.GoogleClientId.value || "",
      clientSecret: Resource.GoogleClientSecret.value || "",
    },
    github: {
      clientId: Resource.GithubClientId.value || "",
      clientSecret: Resource.GithubClientSecret.value || "",
    },
  },
});
