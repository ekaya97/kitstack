# Deployment Pipeline — Dev Notes

Tickets: T-0047 (S3 bundle upload), T-0048 (registry seeding), T-0049 (proxied DB client), T-0050 (Lambda provisioning)

## What was built

### S3 bundle upload (T-0047)

`packages/sdk/src/deploy/upload.ts` exports `uploadKitBundle()`, which reads everything under `.kitstack/build/` and uploads it to the KitAssets S3 bucket, namespaced by kit ID.

Upload layout:

| Local path | S3 key |
|------------|--------|
| `views/**` | `apps/kits/{kitId}/views/**` |
| `shell.html` | `apps/kits/{kitId}/shell.html` |
| `kit.mjs` | `bundles/{kitId}/kit.mjs` |
| `manifest.json` | `bundles/{kitId}/manifest.json` |

Content-Type is inferred from file extension. Cache-Control defaults to `no-cache` for dev — production deployments should use content-hash URLs or CloudFront invalidation (see gotchas below).

The AWS SDK (`@aws-sdk/client-s3`) is lazy-loaded via dynamic `import()` so the module can be imported in environments that don't have it installed (e.g., test runners) without crashing at module evaluation time.

### Registry seeding from manifest (T-0048)

`packages/sdk/src/deploy/seed-registry.ts` exports `seedRegistry()`, which connects to Turso and upserts rows into `kit_registry` (tools) and `kit_views` (views) from the build manifest.

All writes use `INSERT OR REPLACE` so re-running is idempotent. The `input_schema` column is seeded as `"{}"` because the McpRouter derives the full JSON Schema from Zod at runtime — the registry row just needs to exist so the tool appears in `tools/list`.

### Proxied DB client for sandboxed kits (T-0049)

`packages/sdk/src/runtime/proxied-db.ts` exports `createProxiedDbClient()`, which returns a Drizzle `LibSQLDatabase` instance that routes all SQL through the McpRouter Lambda instead of connecting to Turso directly.

The client implements the libSQL interface (`execute` and `batch`) by serializing queries as JSON, invoking the McpRouter via `lambda.invoke()` with a `__dbProxy: true` flag, and deserializing the result. The kit code is unaware of the proxy — `db.insert(...)` and `db.select(...)` work identically to a direct connection.

The security boundary: sandboxed kit Lambdas never receive database credentials. They get an `invocationToken` (60-second TTL) that the McpRouter validates before executing the query. If the token is expired or invalid, the proxy returns an error.

### Lambda provisioning (T-0050)

`packages/sdk/src/deploy/deploy-lambda.ts` exports `provisionKitLambda()`, which creates or updates a Lambda function named `Kit-{kitId}`. The function:

- Uses `nodejs22.x` on `arm64`
- Loads its code from S3 (`bundles/{kitId}/kit.mjs`)
- Attaches a shared runtime layer (SDK, Drizzle, libsql, AWS SDK)
- Runs under `KitLambdaRole`, which only has `lambda:InvokeFunction` on the McpRouter

Environment variables are explicitly empty. Sandboxed kits receive context (`invocationToken`, `routerArn`, `userId`, `kitId`) per invocation payload, not via env vars. This prevents a kit author from extracting secrets by reading `process.env`.

If the function already exists, `provisionKitLambda` updates code first, waits for the update to propagate (`waitUntilFunctionActiveV2`), then updates configuration. This two-step sequence is required because Lambda rejects config updates while a code update is in progress.

## What was learned

### S3 cache invalidation is not automatic

Setting `Cache-Control: no-cache` on S3 objects does NOT invalidate CloudFront edge caches. CloudFront respects `Cache-Control` only on cache miss — if an object is already cached at an edge, it stays there until TTL expiry or explicit invalidation.

During development this is a non-issue because we set `max-age=0, no-cache, no-store, must-revalidate`. But for production, the choices are:

1. **Content-hash URLs** (preferred) — embed a hash in the S3 key (e.g., `views/crm/pipeline-a3f2b1.js`). CloudFront caches forever, and new deployments use new keys.
2. **CloudFront invalidation** — call `CreateInvalidation` on `apps/kits/{kitId}/*` after upload. Works but costs $0.005 per path and takes 5-15 minutes to propagate globally.

Currently, the upload function does not handle either. The build pipeline needs to produce content-hashed filenames, and the shell HTML needs to reference them. This is a follow-up task.

### Proxied DB adapter pattern

The proxy client works because Drizzle only depends on two methods from `@libsql/client`: `execute(stmt)` and `batch(stmts)`. Both accept the same `{ sql, args }` shape and return `{ columns, rows, rowsAffected, lastInsertRowid }`. Serializing this over JSON is straightforward except for `lastInsertRowid`, which is a `BigInt` in libsql. `JSON.stringify` throws on BigInt, so the router serializes it as a number (safe for row IDs under 2^53) and the proxy client coerces it back.

The `close()` method is a no-op because the proxy doesn't hold a persistent connection. Each `execute` call is a stateless Lambda invocation. This means there's no connection pooling concern, but it also means every query has the overhead of a Lambda invoke (~10-30ms latency). For typical kit tool handlers that run 1-3 queries, this is acceptable.

### Lambda IAM isolation

The `KitLambdaRole` is intentionally restrictive:

- **No database credentials** — queries go through the proxy, authenticated by invocation tokens.
- **No VPC access** — sandboxed kits run in the default Lambda network. They can make outbound HTTPS calls but cannot reach internal resources.
- **No S3 read on other kits' bundles** — the role has no S3 permissions. Code is loaded at deploy time, not at runtime.
- **Only `lambda:InvokeFunction` on the McpRouter** — this is the sole permission, scoped to the router's ARN. A compromised kit can invoke the router but nothing else.

The McpRouter itself needs a wildcard `lambda:InvokeFunction` on `Kit-*` functions to invoke dynamically provisioned kits. This is configured in `infra/mcp.ts` via SST's IAM policy builder.

### waitUntilFunctionActiveV2 ordering

When updating an existing Lambda, you must wait for the code update to finish before applying a config update. Lambda rejects `UpdateFunctionConfiguration` with `ResourceConflictException` if a code update is still in progress. The `waitUntilFunctionActiveV2` waiter polls `GetFunction` until the state transitions from `Pending` to `Active`. Without this, deploys intermittently fail on fast-running scripts where the config update fires before the code update completes.

## How to use it

### Full deployment workflow

A deploy script typically runs all three steps in sequence. Execute it under SST's shell so that resource bindings (bucket name, role ARN, etc.) are available:

```bash
npx sst shell -- npx tsx kits/crm/deploy.ts
```

Example `deploy.ts`:

```typescript
import { resolve } from "node:path";
import { uploadKitBundle, seedRegistry, provisionKitLambda } from "@kitstack/sdk/deploy";
import { Resource } from "sst";
import manifest from "./.kitstack/build/manifest.json";

// 1. Upload build artifacts to S3
const count = await uploadKitBundle({
  buildDir: resolve(import.meta.dirname, ".kitstack/build"),
  kitId: manifest.kitId,
  bucketName: Resource.KitAssets.name,
});
console.log(`Uploaded ${count} files\n`);

// 2. Seed the registry so the McpRouter can discover tools and views
await seedRegistry({
  tursoUrl: process.env.TURSO_URL!,
  tursoToken: process.env.TURSO_TOKEN!,
  manifest,
  shellS3Key: `apps/kits/${manifest.kitId}/shell.html`,
  lambdaResource: `Kit-${manifest.kitId}`,
});
console.log("Registry seeded\n");

// 3. Provision (or update) the sandboxed Lambda
const result = await provisionKitLambda({
  kitId: manifest.kitId,
  bucketName: Resource.KitAssets.name,
  bundleS3Key: `bundles/${manifest.kitId}/kit.mjs`,
  roleArn: Resource.KitLambdaRole.arn,
  runtimeLayerArn: Resource.KitRuntimeLayer.arn,
});
console.log(`Lambda ${result.created ? "created" : "updated"}: ${result.functionArn}`);
```

### Build before deploy

The deploy script assumes `.kitstack/build/` already contains the output of `kitstack build`. Always build first:

```bash
npx kitstack build
npx sst shell -- npx tsx kits/crm/deploy.ts
```

### First-party vs. third-party kits

First-party kits (maintained by the platform team) can skip `provisionKitLambda` — they are declared as `sst.aws.Function` resources in `infra/mcp.ts` and deployed with `npx sst deploy`. For these kits, only upload and registry seed are needed.

Third-party kits (submitted by external developers) always use `provisionKitLambda` to get a sandboxed Lambda. Their deploy script is the full three-step workflow above.

### Common mistakes

1. **Running deploy without `sst shell`.** The script needs `Resource.KitAssets.name` and other SST bindings. Without `sst shell`, these are undefined and the deploy fails silently or with cryptic errors.

2. **Forgetting to build before deploying.** The upload function does not fail on a missing build directory — it just uploads zero files. Always run `kitstack build` first and check that `.kitstack/build/manifest.json` exists.

3. **Deploying a new Lambda without updating the McpRouter IAM policy.** The router needs `lambda:InvokeFunction` on `Kit-*` functions. If you change the naming convention (e.g., `KitStack-{kitId}` instead of `Kit-{kitId}`), the wildcard won't match and invocations will fail with AccessDenied.

4. **Expecting proxied DB queries to be fast.** Each query goes through a Lambda invoke (~10-30ms). Batch operations should use the `batch()` method, which sends multiple statements in a single invoke, rather than issuing individual `execute()` calls in a loop.
