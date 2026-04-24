import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import { resource } from "./resource";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: resource("GoogleClientId")?.value || "",
      clientSecret: resource("GoogleClientSecret")?.value || "",
    },
    github: {
      clientId: resource("GithubClientId")?.value || "",
      clientSecret: resource("GithubClientSecret")?.value || "",
    },
  },
});
