import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { count } from "drizzle-orm";
import { db } from "./db";
import { Resource } from "sst";
import * as schema from "@/db/schema";
import { user as userTable } from "@/db/auth-schema";
import { createSubscription } from "@/services/subscription.service";
import { trackEarlyAdopterProGranted } from "./analytics-server";

const EARLY_ADOPTER_LIMIT = 50;

export const auth = betterAuth({
  secret: Resource.BetterAuthSecret.value,
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema,
  }),
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          try {
            const [{ total }] = await db
              .select({ total: count() })
              .from(userTable);

            if (total <= EARLY_ADOPTER_LIMIT) {
              await createSubscription(user.id, "pro");
              trackEarlyAdopterProGranted(user.id, total);
            }
          } catch (e) {
            console.error("[auth] early-adopter hook failed:", e);
          }
        },
      },
    },
  },
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
