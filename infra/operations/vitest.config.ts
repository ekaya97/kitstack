import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["infra/operations/operations.test.ts"],
  },
});
