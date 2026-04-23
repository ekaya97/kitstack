import { bucket } from "./storage";

export const web = new sst.aws.Nextjs("Web", {
  link: [bucket],
  environment: {
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL || "",
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN || "",
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || "",
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
    SITE_URL: process.env.SITE_URL || "http://localhost:3000",
    LEMONSQUEEZY_API_KEY: process.env.LEMONSQUEEZY_API_KEY || "",
    LEMONSQUEEZY_STORE_ID: process.env.LEMONSQUEEZY_STORE_ID || "",
    LEMONSQUEEZY_WEBHOOK_SECRET: process.env.LEMONSQUEEZY_WEBHOOK_SECRET || "",
  },
});
