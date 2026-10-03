import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@kitstackco/sdk/view": resolve(__dirname, "../../packages/sdk/views/src/shared/use-kit.ts"),
      "@kitstackco/sdk/server": resolve(__dirname, "../../packages/sdk/src/server/index.ts"),
      "@kitstackco/voice": resolve(__dirname, "../../packages/voice/src/index.ts"),
      "@kitstackco/crm": resolve(__dirname, "../../packages/crm/src/index.ts"),
      "@kitstackco/sdk": resolve(__dirname, "../../packages/sdk/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts", "src/**/*.test.ts"],
  },
});
