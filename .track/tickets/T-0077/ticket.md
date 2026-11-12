---
id: T-0077
title: "Deploy: build + deploy CRM kit to production"
status: done
priority: high
created: "2026-04-26T13:10:45Z"
created_by: human
claimed_by: agent-alpha
claimed_at: "2026-04-26T18:47:54Z"
labels:
  - deployment
branch: null
files: []
depends_on: []
---

## Description

## Description

Deploy the CRM kit to production so it works without the dev server running. This means Claude.ai connects to the McpRouter at mcp.kitstack.co, which invokes the Kit-crm Lambda to handle tool calls and loader execution.

### What's already done

- `kitstack build` works — produces `.kitstack/build/` with kit.mjs, view modules, shell, manifest
- `kitstack deploy` uploads to S3 and seeds the registry (kit_registry + kit_views tables in Turso)
- S3 has all view assets (vendor.js, shared.js, per-view .js, CSS, shell.html)
- Registry has 12 tools + 5 views seeded

### What's broken

The Lambda provisioning step in `kits/crm/deploy.ts` fails:

```
InvalidParameterValueException: Could not unzip uploaded file
```

`provisionKitLambda()` in `packages/sdk/src/deploy/deploy-lambda.ts` creates a Lambda with `Code: { S3Bucket, S3Key: "bundles/crm/kit.mjs" }`. But Lambda expects a **zip archive**, not a raw .mjs file.

### What needs to change

1. **`buildKit()` in `packages/sdk/src/build.ts`**: after creating `kit.mjs`, zip it into `kit.zip` in the build output
2. **`uploadKitBundle()` in `packages/sdk/src/deploy/upload.ts`**: upload `kit.zip` instead of `kit.mjs` to `bundles/{kitId}/kit.zip`
3. **`provisionKitLambda()` in `packages/sdk/src/deploy/deploy-lambda.ts`**: reference `kit.zip` as the S3 key
4. **Lambda handler**: the zip needs an `index.mjs` entry point that the Lambda runtime can find. The current handler is at `kits/crm/handler.ts` — the zip should contain the bundled version with the correct handler path (`index.handler` or similar)
5. **Runtime layer**: `KitRuntimeLayer` provides drizzle-orm, @libsql/client, zod, nanoid at `/opt/nodejs/node_modules/`. The kit.mjs externalizes these. The layer zip is at `packages/sdk/layer/layer.zip` (5.7MB), built via `npm run build:layer`
6. **IAM role**: `KitLambdaRole` in `infra/mcp.ts` — only has CloudWatch Logs permission. DB credentials come per-invocation

### How the router invokes kit Lambdas

`getKitFunctionId()` in `packages/mcp-server/src/router/kit-resources.ts` returns `Kit-{kitId}` by convention. The router calls `invokeKitLambda(functionName, payload)` with:

```typescript
{
  toolName?: string,
  loaderSlug?: string,
  args?: Record<string, unknown>,
  userId: string,
  kitId: string,
  dbUrl: string,
  dbToken: string,
}
```

The kit Lambda handler (`kits/crm/handler.ts`) receives this and dispatches to the right tool/loader.

### How to test

```bash
# 1. Build
npx tsx kits/crm/build.ts

# 2. Deploy (needs sst shell for Resource bindings)
npx sst shell -- npx tsx kits/crm/deploy.ts

# 3. Verify Lambda exists
aws lambda get-function --function-name Kit-crm --profile enkaprojects --region eu-central-1

# 4. Test via Claude.ai (without dev server running)
# Add MCP server: https://mcp.kitstack.co (or the McpDomain CloudFront URL)
# Ask: "show me my contacts"
```

### Acceptance criteria

- [ ] `kitstack build` produces a zip archive for the server bundle
- [ ] `kitstack deploy` creates/updates Kit-crm Lambda successfully
- [ ] Kit-crm Lambda invokes correctly from the McpRouter
- [ ] Tool calls work (add_contact, list_contacts, etc.)
- [ ] kit_view renders views from CDN (not relay)
- [ ] Works without dev server running


## Work Log