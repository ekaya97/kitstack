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

export const mcpAuthStore = new sst.aws.Dynamo("MCPAuthStore", {
  fields: { pk: "string", sk: "string" },
  primaryIndex: { hashKey: "pk", rangeKey: "sk" },
  ttl: "ttl",
});

// --- Kit Lambda shared infra (for SDK deploy pipeline) ---
// Kit Lambdas are provisioned dynamically via `provisionKitLambda()`.
// All kits share one IAM role, one runtime layer, and one VPC.

/**
 * VPC for kit Lambdas. No NAT = no outbound internet.
 * Kit code can only reach the DB proxy via the Lambda VPC endpoint.
 * Future: kits with `network: { outbound: true }` get a NAT-enabled subnet.
 */
export const kitVpc = new sst.aws.Vpc("KitVpc", { az: 1 });

/**
 * VPC endpoint for AWS Lambda service. Required for kit Lambdas to
 * invoke the McpRouter (DB proxy) from within the VPC without NAT.
 * Cost: ~$7/month.
 */
const lambdaEndpoint = new aws.ec2.VpcEndpoint("KitLambdaEndpoint", {
  vpcId: kitVpc.nodes.vpc.id,
  serviceName: `com.amazonaws.eu-central-1.lambda`,
  vpcEndpointType: "Interface",
  subnetIds: kitVpc.privateSubnets,
  securityGroupIds: kitVpc.securityGroups,
  privateDnsEnabled: true,
});

/**
 * IAM role for all kit Lambdas.
 * Allows CloudWatch Logs + VPC networking (ENI management).
 * No DB, S3, or other AWS access. DB proxy is the only escape path.
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

// Kit Lambdas need ENI permissions to run inside a VPC
new aws.iam.RolePolicyAttachment("KitLambdaRoleVpc", {
  role: kitLambdaRole.name,
  policyArn: "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole",
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
  code: new $util.asset.FileArchive(
    require("path").resolve(process.cwd(), "packages/sdk/layer/layer.zip")
  ),
});

/** Linkable so deploy scripts can read the ARNs via Resource bindings. */
export const kitLambdaInfra = new sst.Linkable("KitLambdaInfra", {
  properties: {
    roleArn: kitLambdaRole.arn,
    layerArn: kitRuntimeLayer.arn,
    subnetIds: kitVpc.privateSubnets,
    securityGroupIds: kitVpc.securityGroups,
  },
});

// --- App Data Lambda (JWT → Turso → JSON for iframe apps) ---

export const appData = new sst.aws.Function("AppData", {
  handler: "packages/mcp-server/src/app-data/handler.handler",
  timeout: "15 seconds",
  memory: "256 MB",
  runtime: "nodejs22.x",
  architecture: "arm64",
  logging: { retention: "1 week" },
  nodejs: {
    install: ["@libsql/client", "libsql"],
  },
  url: { cors: false },
  link: [
    userKitDbs,
    mcpJwtSecret,
    mcpAllowedOrigins,
    posthogKey,
    posthogHost,
  ],
});

// --- DevRelay store (short-lived relay requests/responses + sessions) ---

export const devRelayStore = new sst.aws.Dynamo("DevRelayStore", {
  fields: { pk: "string", sk: "string" },
  primaryIndex: { hashKey: "pk", rangeKey: "sk" },
  ttl: "ttl",
});

// --- DevRelay WebSocket API (for kitstack dev relay mode) ---

const relayConnect = new sst.aws.Function("RelayConnect", {
  handler: "packages/mcp-server/src/relay/connect.handler",
  timeout: "10 seconds",
  memory: "128 MB",
  runtime: "nodejs22.x",
  architecture: "arm64",
  logging: { retention: "1 week" },
  link: [mcpAuthStore],
});

const relayDisconnect = new sst.aws.Function("RelayDisconnect", {
  handler: "packages/mcp-server/src/relay/disconnect.handler",
  timeout: "10 seconds",
  memory: "128 MB",
  runtime: "nodejs22.x",
  architecture: "arm64",
  logging: { retention: "1 week" },
  link: [devRelayStore],
});

const relayDefault = new sst.aws.Function("RelayDefault", {
  handler: "packages/mcp-server/src/relay/default.handler",
  timeout: "10 seconds",
  memory: "128 MB",
  runtime: "nodejs22.x",
  architecture: "arm64",
  logging: { retention: "1 week" },
  link: [devRelayStore],
});

export const devRelay = new sst.aws.ApiGatewayWebSocket("DevRelay", {
  domain: $app.stage != "production" ? undefined : "relay.kitstack.co",
});

const relayAuth = devRelay.addAuthorizer("RelayAuth", {
  lambda: {
    function: {
      handler: "packages/mcp-server/src/relay/authorizer.handler",
      timeout: "10 seconds",
      memory: "128 MB",
      runtime: "nodejs22.x",
      architecture: "arm64",
      logging: { retention: "1 week" },
      nodejs: {
        install: ["@libsql/client", "libsql"],
      },
      link: [tursoDbUrl, tursoAuthToken],
    },
    identitySources: ["route.request.querystring.sessionId", "route.request.querystring.token"],
  },
});

devRelay.route("$connect", relayConnect.arn, {
  auth: { lambda: relayAuth.id },
});
devRelay.route("$disconnect", relayDisconnect.arn);
devRelay.route("$default", relayDefault.arn);

// --- Router Lambda (MCP protocol + OAuth + dispatch) ---
// --- MCP Router Domain ---

export const mcpDomain = new sst.aws.Router("McpDomain", {
  domain: $app.stage != "production" ? undefined : "mcp.kitstack.co",
  waf: {
    rateLimitPerIp: 1000,  // 1000 requests per IP per 5-minute window
  },
});

export const mcpRouter = new sst.aws.Function("McpRouter", {
  handler: "packages/mcp-server/src/router/handler.handler",
  timeout: "60 seconds",
  memory: "512 MB",
  runtime: "nodejs22.x",
  architecture: "arm64",
  logging: { retention: "1 week" },
  concurrency: { reserved: 25 },
  nodejs: {
    install: ["@libsql/client", "libsql"],
  },
  url: { cors: false },
  link: [
    kitBucket,
    kitCdn,
    kitLambdaInfra,
    userKitDbs,
    mcpAuthStore,
    devRelay,
    devRelayStore,
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
    mcpDomain
  ],
  permissions: [
    {
      actions: ["lambda:InvokeFunction"],
      resources: ["arn:aws:lambda:*:*:function:Kit-*"],
    },
    {
      actions: ["execute-api:ManageConnections"],
      resources: ["arn:aws:execute-api:*:*:*"],
    },
  ],
});



mcpDomain.route("/", mcpRouter.url)

// --- Kill Switch (cost protection) ---

const killSwitchTopic = new aws.sns.Topic("KillSwitchTopic");

// Email alert (set your email via `sst secret set KillSwitchEmail you@example.com`)
new aws.sns.TopicSubscription("KillSwitchEmail", {
  topic: killSwitchTopic.arn,
  protocol: "email",
  endpoint: "eneskaya2912@gmail.com",
});

const killSwitchFn = new sst.aws.Function("KillSwitch", {
  handler: "packages/mcp-server/src/kill-switch/handler.handler",
  timeout: "30 seconds",
  memory: "128 MB",
  runtime: "nodejs22.x",
  logging: { retention: "1 week" },
  architecture: "arm64",
  environment: {
    ROUTER_FUNCTION_NAME: mcpRouter.nodes.function.name,
  },
  permissions: [
    {
      actions: [
        "lambda:ListFunctions",
        "lambda:PutFunctionConcurrency",
      ],
      resources: ["*"],
    },
  ],
});

// Allow SNS to invoke the kill switch Lambda
new aws.lambda.Permission("KillSwitchSnsPermission", {
  action: "lambda:InvokeFunction",
  function: killSwitchFn.nodes.function.name,
  principal: "sns.amazonaws.com",
  sourceArn: killSwitchTopic.arn,
});

new aws.sns.TopicSubscription("KillSwitchLambda", {
  topic: killSwitchTopic.arn,
  protocol: "lambda",
  endpoint: killSwitchFn.nodes.function.arn,
});

// Alarm: McpRouter invocations > 300/min
new aws.cloudwatch.MetricAlarm("KitInvocationAlarm", {
  alarmDescription: "MCP Router invocations exceeded 300/min — kill switch triggered",
  namespace: "AWS/Lambda",
  metricName: "Invocations",
  dimensions: { FunctionName: mcpRouter.nodes.function.name },
  statistic: "Sum",
  period: 60,
  evaluationPeriods: 1,
  threshold: 300,
  comparisonOperator: "GreaterThanThreshold",
  alarmActions: [killSwitchTopic.arn],
  treatMissingData: "notBreaching",
});

// Alarm: McpRouter concurrent executions > 50
new aws.cloudwatch.MetricAlarm("KitConcurrencyAlarm", {
  alarmDescription: "MCP Router concurrent executions exceeded 50 — kill switch triggered",
  namespace: "AWS/Lambda",
  metricName: "ConcurrentExecutions",
  dimensions: { FunctionName: mcpRouter.nodes.function.name },
  statistic: "Maximum",
  period: 60,
  evaluationPeriods: 1,
  threshold: 50,
  comparisonOperator: "GreaterThanThreshold",
  alarmActions: [killSwitchTopic.arn],
  treatMissingData: "notBreaching",
})