import { defineConfig } from "vitest/config";

/** Keep kit tests independent from the root web application's setup files. */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
