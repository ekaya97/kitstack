/**
 * Dynamic Lambda provisioning for third-party kits.
 *
 * Creates or updates a Lambda function named `Kit-{kitId}` that runs the
 * kit's server bundle from S3. The Lambda uses a shared runtime layer
 * (SDK, Drizzle, libsql, AWS SDK) and an IAM role restricted to
 * `lambda:InvokeFunction` on the McpRouter — no database credentials,
 * no VPC access, no other AWS permissions.
 *
 * This replaces the hardcoded per-kit `sst.aws.Function` declarations in
 * `infra/mcp.ts`. The McpRouter needs a wildcard IAM permission for
 * `Kit-*` functions to invoke dynamically provisioned kits.
 *
 * @module
 */

export interface DeployLambdaOptions {
  /** Kit ID (e.g., "crm"). The Lambda is named `Kit-{kitId}`. */
  kitId: string;
  /** S3 bucket containing the kit bundle. */
  bucketName: string;
  /** S3 key for the server bundle zip (e.g., "bundles/crm/kit.zip"). */
  bundleS3Key: string;
  /** ARN of the KitLambdaRole (only lambda:InvokeFunction on McpRouter). */
  roleArn: string;
  /** ARN of the runtime layer (SDK + drizzle + libsql + aws-sdk). */
  runtimeLayerArn: string;
  /** Memory in MB. Default: 128. */
  memory?: number;
  /** Timeout in seconds. Default: 10. */
  timeout?: number;
  /** Reserved concurrent executions. Default: 5. */
  reservedConcurrency?: number;
  /** VPC subnet IDs. When set, the Lambda runs inside a VPC. */
  subnetIds?: string[];
  /** VPC security group IDs. Required when subnetIds is set. */
  securityGroupIds?: string[];
  /** AWS region. Default: from environment. */
  region?: string;
}

export interface DeployLambdaResult {
  /** The Lambda function name (e.g., "Kit-crm"). */
  functionName: string;
  /** The Lambda function ARN. */
  functionArn: string;
  /** Whether the function was created (true) or updated (false). */
  created: boolean;
}

/**
 * Create or update a Lambda function for a kit.
 *
 * If a function named `Kit-{kitId}` already exists, its code and
 * configuration are updated. Otherwise, a new function is created.
 *
 * The function loads `kit.mjs` from S3 via the runtime layer's generic
 * handler (`index.main`). Environment variables are explicitly empty —
 * sandboxed kits receive context (invocationToken, routerArn) per
 * invocation, not via env vars.
 *
 * @param options - Lambda provisioning configuration
 * @returns Function name, ARN, and whether it was created or updated
 *
 * @example Deploy the CRM kit Lambda using SST resource bindings:
 * ```typescript
 * import { provisionKitLambda } from "@kitstack/sdk/deploy/deploy-lambda";
 * import { Resource } from "sst";
 *
 * const result = await provisionKitLambda({
 *   kitId: "crm",
 *   bucketName: Resource.KitAssets.name,
 *   bundleS3Key: "bundles/crm/kit.zip",
 *   roleArn: Resource.KitLambdaRole.arn,
 *   runtimeLayerArn: Resource.KitRuntimeLayer.arn,
 * });
 * console.log(`${result.created ? "Created" : "Updated"} ${result.functionName}`);
 * ```
 */
export async function provisionKitLambda(
  options: DeployLambdaOptions
): Promise<DeployLambdaResult> {
  const {
    kitId,
    bucketName,
    bundleS3Key,
    roleArn,
    runtimeLayerArn,
    memory = 128,
    timeout = 10,
    reservedConcurrency = 5,
    subnetIds,
    securityGroupIds,
  } = options;

  const vpcConfig = subnetIds?.length
    ? { SubnetIds: subnetIds, SecurityGroupIds: securityGroupIds ?? [] }
    : undefined;

  const {
    LambdaClient,
    GetFunctionCommand,
    CreateFunctionCommand,
    UpdateFunctionCodeCommand,
    UpdateFunctionConfigurationCommand,
    PutFunctionConcurrencyCommand,
    waitUntilFunctionActiveV2,
    waitUntilFunctionUpdatedV2,
  } = await import("@aws-sdk/client-lambda");

  const lambda = new LambdaClient({ region: options.region });
  const functionName = `Kit-${kitId}`;

  let created = false;
  let functionArn: string;

  try {
    // Check if function exists
    const existing = await lambda.send(
      new GetFunctionCommand({ FunctionName: functionName })
    );
    functionArn = existing.Configuration!.FunctionArn!;

    // Wait for any in-progress update to complete before modifying
    await waitUntilFunctionUpdatedV2(
      { client: lambda, maxWaitTime: 300 },
      { FunctionName: functionName }
    );

    // Update code
    await lambda.send(
      new UpdateFunctionCodeCommand({
        FunctionName: functionName,
        S3Bucket: bucketName,
        S3Key: bundleS3Key,
      })
    );

    // Wait for code update to complete before updating config
    await waitUntilFunctionUpdatedV2(
      { client: lambda, maxWaitTime: 300 },
      { FunctionName: functionName }
    );

    // Update configuration (memory, timeout, layer version, VPC may have changed)
    await lambda.send(
      new UpdateFunctionConfigurationCommand({
        FunctionName: functionName,
        MemorySize: memory,
        Timeout: timeout,
        Layers: [runtimeLayerArn],
        Environment: { Variables: {} },
        ...(vpcConfig ? { VpcConfig: vpcConfig } : {}),
      })
    );

    // Wait for config update to complete before setting concurrency
    await waitUntilFunctionUpdatedV2(
      { client: lambda, maxWaitTime: 300 },
      { FunctionName: functionName }
    );

    console.log(`  ✓ Updated Lambda ${functionName}`);
  } catch (err: any) {
    if (err.name !== "ResourceNotFoundException") {
      throw err;
    }

    // Create new function
    const createResult = await lambda.send(
      new CreateFunctionCommand({
        FunctionName: functionName,
        Runtime: "nodejs22.x",
        Architectures: ["arm64"],
        Handler: "index.handler",
        MemorySize: memory,
        Timeout: timeout,
        Role: roleArn,
        Code: {
          S3Bucket: bucketName,
          S3Key: bundleS3Key,
        },
        Layers: [runtimeLayerArn],
        Environment: { Variables: {} },
        ...(vpcConfig ? { VpcConfig: vpcConfig } : {}),
      })
    );

    functionArn = createResult.FunctionArn!;
    created = true;

    // Wait for function to become active
    await waitUntilFunctionActiveV2(
      { client: lambda, maxWaitTime: 60 },
      { FunctionName: functionName }
    );

    console.log(`  ✓ Created Lambda ${functionName}`);
  }

  // Set reserved concurrency to cap parallel executions
  await lambda.send(
    new PutFunctionConcurrencyCommand({
      FunctionName: functionName,
      ReservedConcurrentExecutions: reservedConcurrency,
    })
  );
  console.log(`  ✓ Reserved concurrency set to ${reservedConcurrency}`);

  return { functionName, functionArn, created };
}
