import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    root: resolve(__dirname),
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@mcp": resolve(__dirname, "./src"),
    },
  },
});
