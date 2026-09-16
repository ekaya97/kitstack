import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@kitstackco/sdk/view": resolve(__dirname, "../../packages/sdk/views/src/shared/use-kit.ts"),
      "@kitstackco/sdk": resolve(__dirname, "../../packages/sdk/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts", "src/**/*.test.ts"],
  },
});
