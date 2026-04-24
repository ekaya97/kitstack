// --- DynamoDB Tables ---

export const kitRegistry = new sst.aws.Dynamo("KitRegistry", {
  fields: { kitId: "string", toolName: "string" },
  primaryIndex: { hashKey: "kitId", rangeKey: "toolName" },
});

export const userKitDbs = new sst.aws.Dynamo("UserKitDbs", {
  fields: { userId: "string", kitId: "string" },
  primaryIndex: { hashKey: "userId", rangeKey: "kitId" },
});

export const oauthStore = new sst.aws.Dynamo("OAuthStore", {
  fields: { pk: "string", sk: "string" },
  primaryIndex: { hashKey: "pk", rangeKey: "sk" },
  ttl: "ttl",
});

// --- Kit Lambdas (one per kit, lean cold starts) ---

const kitLambdaDefaults = {
  timeout: "30 seconds" as const,
  memory: "256 MB" as const,
  runtime: "nodejs22.x" as const,
  architecture: "arm64" as const,
};

export const kitMeeting = new sst.aws.Function("KitMeeting", {
  ...kitLambdaDefaults,
  handler: "packages/mcp-server/src/kits/meeting/handler.handler",
});

export const kitCrm = new sst.aws.Function("KitCrm", {
  ...kitLambdaDefaults,
  handler: "packages/mcp-server/src/kits/crm/handler.handler",
});

export const kitExpense = new sst.aws.Function("KitExpense", {
  ...kitLambdaDefaults,
  handler: "packages/mcp-server/src/kits/expense/handler.handler",
});

export const kitOutreach = new sst.aws.Function("KitOutreach", {
  ...kitLambdaDefaults,
  handler: "packages/mcp-server/src/kits/outreach/handler.handler",
});

// --- Router Lambda (MCP protocol + OAuth + dispatch) ---

export const mcpRouter = new sst.aws.Function("McpRouter", {
  handler: "packages/mcp-server/src/router/handler.handler",
  timeout: "60 seconds",
  memory: "512 MB",
  runtime: "nodejs22.x",
  architecture: "arm64",
  url: true,
  link: [kitRegistry, userKitDbs, oauthStore],
  environment: {
    TURSO_PLATFORM_API_TOKEN: process.env.TURSO_PLATFORM_API_TOKEN || "",
    TURSO_ORG_NAME: process.env.TURSO_ORG_NAME || "",
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || "",
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
    MCP_JWT_SECRET: process.env.MCP_JWT_SECRET || "",
    KIT_REGISTRY_TABLE: kitRegistry.name,
    USER_KIT_DBS_TABLE: userKitDbs.name,
    OAUTH_STORE_TABLE: oauthStore.name,
    KIT_MEETING_ARN: kitMeeting.arn,
    KIT_CRM_ARN: kitCrm.arn,
    KIT_EXPENSE_ARN: kitExpense.arn,
    KIT_OUTREACH_ARN: kitOutreach.arn,
  },
  permissions: [
    {
      actions: ["lambda:InvokeFunction"],
      resources: [kitMeeting.arn, kitCrm.arn, kitExpense.arn, kitOutreach.arn],
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

// --- App Data Lambda (JWT → Turso → JSON for iframe apps) ---

export const appData = new sst.aws.Function("AppData", {
  handler: "packages/mcp-server/src/app-data/handler.handler",
  timeout: "15 seconds",
  memory: "256 MB",
  runtime: "nodejs22.x",
  architecture: "arm64",
  url: true,
  link: [userKitDbs],
  environment: {
    MCP_JWT_SECRET: process.env.MCP_JWT_SECRET || "",
    USER_KIT_DBS_TABLE: userKitDbs.name,
  },
});
