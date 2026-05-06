/// <reference path="./.sst/platform/config.d.ts" />
import type { Config } from "drizzle-kit";
import { Resource } from "sst";

export default {
  schema: "./web/src/db/schema.ts",
  out: "./infra/migrations",
  dialect: "turso",
  dbCredentials: {
    url: Resource.TursoDbUrl.value,
    authToken: (Resource as any).TursoAuthToken.value,
  },
} satisfies Config;
