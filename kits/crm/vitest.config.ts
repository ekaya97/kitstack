import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@kitstackdev/kit/testing": resolve(__dirname, "../../packages/sdk/src/testing/index.ts"),
      "@kitstackdev/kit": resolve(__dirname, "../../packages/sdk/src/index.ts"),
      "@shared/use-kit": resolve(__dirname, "../../packages/sdk/views/src/shared/use-kit.ts"),
    },
  },
});
