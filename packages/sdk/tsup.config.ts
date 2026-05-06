import { defineConfig } from "tsup";
import { cpSync } from "node:fs";

export default defineConfig({
  entry: {
    // Public exports
    "index": "src/index.ts",
    "testing/index": "src/testing/index.ts",
    "runtime/index": "src/runtime/index.ts",
    "server/index": "src/server/index.ts",
    "tailwind-preset": "src/tailwind-preset.ts",
    "build": "src/build.ts",

    // CLI
    "cli/index": "src/cli/index.ts",
    "cli/credentials": "src/cli/credentials.ts",
    "cli/kit-runtime": "src/cli/kit-runtime.ts",
    "cli/dev-logger": "src/cli/dev-logger.ts",
    "cli/commands/init": "src/cli/commands/init.ts",
    "cli/commands/dev": "src/cli/commands/dev.ts",
    "cli/commands/build": "src/cli/commands/build.ts",
    "cli/commands/deploy": "src/cli/commands/deploy.ts",
    "cli/commands/publish": "src/cli/commands/publish.ts",
    "cli/commands/serve": "src/cli/commands/serve.ts",
    "cli/commands/call": "src/cli/commands/call.ts",
    "cli/commands/login": "src/cli/commands/login.ts",

    // Deploy helpers
    "deploy/index": "src/deploy/index.ts",
    "deploy/upload": "src/deploy/upload.ts",
    "deploy/seed-registry": "src/deploy/seed-registry.ts",
    "deploy/deploy-lambda": "src/deploy/deploy-lambda.ts",

    // DevKit
    "devkit/index": "src/devkit/index.ts",
    "devkit/server": "src/devkit/server.ts",
    "devkit/host": "src/devkit/host.ts",
    "devkit/proxy": "src/devkit/proxy.ts",

    // Runtime internals (needed by CLI commands)
    "runtime/dev-db": "src/runtime/dev-db.ts",
    "runtime/mcp-handler": "src/runtime/mcp-handler.ts",
    "runtime/proxied-db": "src/runtime/proxied-db.ts",
    "runtime/relay-client": "src/runtime/relay-client.ts",
    "runtime/stdio": "src/runtime/stdio.ts",
    "runtime/zod-to-json-schema": "src/runtime/zod-to-json-schema.ts",

    // Server internals
    "server/protocol": "src/server/protocol.ts",
    "server/description": "src/server/description.ts",
    "server/kit-router": "src/server/kit-router.ts",
    "server/view-router": "src/server/view-router.ts",
    "server/types": "src/server/types.ts",
    "server/adapters/local": "src/server/adapters/local.ts",
    "server/auth/index": "src/server/auth/index.ts",
    "server/auth/adapter": "src/server/auth/adapter.ts",
    "server/auth/kitstack": "src/server/auth/kitstack.ts",
    "server/auth/none": "src/server/auth/none.ts",
    "server/auth/oauth": "src/server/auth/oauth.ts",

    // Shared internals
    "types": "src/types.ts",
    "errors": "src/errors.ts",
    "result": "src/result.ts",
    "define-kit": "src/define-kit.ts",
    "define-tool": "src/define-tool.ts",
    "define-view": "src/define-view.ts",
    "define-loader": "src/define-loader.ts",
    "migrations": "src/migrations.ts",
    "shell-template": "src/shell-template.ts",
    "preview-template": "src/preview-template.ts",
  },
  format: "esm",
  target: "node22",
  platform: "node",
  dts: true,
  splitting: false,
  clean: true,
  sourcemap: false,
  // Don't bundle dependencies — keep them as external imports
  external: [
    "sst",
    "zod",
    "drizzle-orm",
    "esbuild",
    "vite",
    "@vitejs/plugin-react",
    "@libsql/client",
    "@aws-sdk/client-s3",
    "@aws-sdk/client-lambda",
    "@aws-sdk/client-cloudwatch-logs",
    "picocolors",
    "tsx",
    "nanoid",
    "tailwindcss",
    "react",
    "react-dom",
  ],
  onSuccess: async () => {
    // Copy non-TS assets to dist
    cpSync("src/devkit/app.html", "dist/devkit/app.html");
  },
});
