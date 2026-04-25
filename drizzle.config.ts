import type { Config } from "drizzle-kit";

export default {
  schema: "./web/src/db/schema.ts",
  out: "./infra/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL || "http://127.0.0.1:8080",
  },
} satisfies Config;
