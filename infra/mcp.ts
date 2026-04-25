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
// Set these secrets after initial AWS setup:
//   npx sst secret set KitLambdaRoleArn arn:aws:iam::ACCOUNT:role/KitLambdaRole
//   npx sst secret set KitRuntimeLayerArn arn:aws:lambda:REGION:ACCOUNT:layer:KitRuntime:VERSION

/** IAM role ARN for kit Lambdas (CloudWatch Logs only, no DB/VPC access). */
export const kitLambdaRoleArn = new sst.Secret("KitLambdaRoleArn", "");

/** Runtime layer ARN (drizzle-orm, @libsql/client, zod, nanoid). */
export const kitRuntimeLayerArn = new sst.Secret("KitRuntimeLayerArn", "");

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
    kitLambdaRoleArn,
    kitRuntimeLayerArn,
    userKitDbs,
    oauthStore,
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
  ],
});

// --- DevRelay WebSocket API (for kitstack dev relay mode) ---

const relayConnect = new sst.aws.Function("RelayConnect", {
  handler: "packages/mcp-server/src/relay/connect.handler",
  timeout: "10 seconds",
  memory: "128 MB",
  runtime: "nodejs22.x",
  architecture: "arm64",
  link: [oauthStore],
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

// --- MCP Router Domain ---

export const mcpDomain = new sst.aws.Router("McpDomain", {
  domain: $dev ? undefined : "mcp.kitstack.co",
  routes: {
    "/*": mcpRouter.url,
  },
});
