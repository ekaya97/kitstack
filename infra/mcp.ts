import {
  tursoDbUrl,
  tursoAuthToken,
  tursoPlatformApiToken,
  tursoOrgName,
  betterAuthSecret,
  betterAuthUrl,
  mcpJwtSecret,
  mcpAllowedOrigins,
  mcpInternalApiKey,
  posthogKey,
  posthogHost,
} from "./secrets";
import { kitBucket, kitCdn } from "./storage";

// --- DynamoDB Tables ---
// Kit Registry moved to main Turso DB (kit_registry table)

export const userKitDbs = new sst.aws.Dynamo("UserKitDbs", {
  fields: { userId: "string", kitId: "string" },
  primaryIndex: { hashKey: "userId", rangeKey: "kitId" },
});

export const oauthStore = new sst.aws.Dynamo("OAuthStore", {
  fields: { pk: "string", sk: "string" },
  primaryIndex: { hashKey: "pk", rangeKey: "sk" },
  ttl: "ttl",
});

// --- Kit Lambda shared infra (for SDK deploy pipeline) ---
// Kit Lambdas are provisioned dynamically via `provisionKitLambda()`.
// All kits share one IAM role and one runtime layer.

/**
 * IAM role for all kit Lambdas.
 * Only allows CloudWatch Logs — no DB, VPC, or S3 access.
 * DB credentials are passed per-invocation by the router.
 */
export const kitLambdaRole = new aws.iam.Role("KitLambdaRole", {
  assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
    Service: "lambda.amazonaws.com",
  }),
});

new aws.iam.RolePolicyAttachment("KitLambdaRoleLogs", {
  role: kitLambdaRole.name,
  policyArn: "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
});

/**
 * Runtime layer for kit Lambdas.
 * Contains shared node_modules: drizzle-orm, @libsql/client, zod, nanoid.
 *
 * Built from packages/sdk/layer/ — run `packages/sdk/layer/build.sh`
 * before deploying. SST uploads the zip and creates a new layer version
 * automatically when the contents change.
 */
export const kitRuntimeLayer = new aws.lambda.LayerVersion("KitRuntimeLayer", {
  layerName: "KitRuntime",
  compatibleRuntimes: ["nodejs22.x"],
  compatibleArchitectures: ["arm64"],
  code: new $util.asset.FileArchive("packages/sdk/layer/layer.zip"),
});

/** Linkable so deploy scripts can read the ARNs via Resource bindings. */
export const kitLambdaInfra = new sst.Linkable("KitLambdaInfra", {
  properties: {
    roleArn: kitLambdaRole.arn,
    layerArn: kitRuntimeLayer.arn,
  },
});

// --- App Data Lambda (JWT → Turso → JSON for iframe apps) ---

export const appData = new sst.aws.Function("AppData", {
  handler: "packages/mcp-server/src/app-data/handler.handler",
  timeout: "15 seconds",
  memory: "256 MB",
  runtime: "nodejs22.x",
  architecture: "arm64",
  url: { cors: false },
  link: [
    userKitDbs,
    mcpJwtSecret,
    mcpAllowedOrigins,
    posthogKey,
    posthogHost,
  ],
});

// --- DevRelay WebSocket API (for kitstack dev relay mode) ---

const relayConnect = new sst.aws.Function("RelayConnect", {
  handler: "packages/mcp-server/src/relay/connect.handler",
  timeout: "10 seconds",
  memory: "128 MB",
  runtime: "nodejs22.x",
  architecture: "arm64",
  link: [oauthStore, tursoDbUrl, tursoAuthToken],
});

const relayDisconnect = new sst.aws.Function("RelayDisconnect", {
  handler: "packages/mcp-server/src/relay/disconnect.handler",
  timeout: "10 seconds",
  memory: "128 MB",
  runtime: "nodejs22.x",
  architecture: "arm64",
  link: [oauthStore],
});

const relayDefault = new sst.aws.Function("RelayDefault", {
  handler: "packages/mcp-server/src/relay/default.handler",
  timeout: "10 seconds",
  memory: "128 MB",
  runtime: "nodejs22.x",
  architecture: "arm64",
  link: [oauthStore],
});

export const devRelay = new sst.aws.ApiGatewayWebSocket("DevRelay", {
  domain: $dev ? undefined : "relay.kitstack.co",
});

devRelay.route("$connect", relayConnect.arn);
devRelay.route("$disconnect", relayDisconnect.arn);
devRelay.route("$default", relayDefault.arn);

// --- Router Lambda (MCP protocol + OAuth + dispatch) ---

export const mcpRouter = new sst.aws.Function("McpRouter", {
  handler: "packages/mcp-server/src/router/handler.handler",
  timeout: "60 seconds",
  memory: "512 MB",
  runtime: "nodejs22.x",
  architecture: "arm64",
  url: true,
  link: [
    kitBucket,
    kitCdn,
    kitLambdaInfra,
    userKitDbs,
    oauthStore,
    devRelay,
    appData,
    tursoDbUrl,
    tursoAuthToken,
    tursoPlatformApiToken,
    tursoOrgName,
    betterAuthSecret,
    betterAuthUrl,
    mcpJwtSecret,
    mcpAllowedOrigins,
    mcpInternalApiKey,
    posthogKey,
    posthogHost,
  ],
  permissions: [
    {
      actions: ["lambda:InvokeFunction"],
      resources: ["arn:aws:lambda:*:*:function:Kit-*"],
    },
    {
      actions: ["execute-api:ManageConnections"],
      resources: ["*"],
    },
  ],
});

// --- MCP Router Domain ---

export const mcpDomain = new sst.aws.Router("McpDomain", {
  domain: $dev ? undefined : "mcp.kitstack.co",
  routes: {
    "/*": mcpRouter.url,
  },
});
