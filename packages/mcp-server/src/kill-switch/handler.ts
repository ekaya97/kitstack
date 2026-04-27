/**
 * Kill switch Lambda — triggered by CloudWatch alarm via SNS.
 *
 * Sets reserved concurrency to 0 on the McpRouter and all Kit-* Lambdas,
 * effectively shutting down the entire MCP platform. Manual recovery
 * required (set concurrency back in the AWS console).
 *
 * Triggers:
 *   - CloudWatch alarm: Kit-* Invocations > 500/min
 *   - CloudWatch alarm: Kit-* ConcurrentExecutions > 20
 *
 * @module
 */

import {
  LambdaClient,
  ListFunctionsCommand,
  PutFunctionConcurrencyCommand,
} from "@aws-sdk/client-lambda";

const lambda = new LambdaClient({});
const ROUTER_FUNCTION_NAME = process.env.ROUTER_FUNCTION_NAME || "";

export const handler = async (event: any): Promise<void> => {
  console.log("[KillSwitch] TRIGGERED — shutting down all kit Lambdas and router");
  console.log("[KillSwitch] Event:", JSON.stringify(event, null, 2));

  const killed: string[] = [];

  // Kill the router first — stops all new requests immediately
  if (ROUTER_FUNCTION_NAME) {
    try {
      await lambda.send(
        new PutFunctionConcurrencyCommand({
          FunctionName: ROUTER_FUNCTION_NAME,
          ReservedConcurrentExecutions: 0,
        })
      );
      killed.push(ROUTER_FUNCTION_NAME);
      console.log(`[KillSwitch] ✓ Router killed: ${ROUTER_FUNCTION_NAME}`);
    } catch (err: any) {
      console.error(`[KillSwitch] ✗ Failed to kill router: ${err.message}`);
    }
  }

  // Kill all Kit-* Lambdas
  let marker: string | undefined;
  do {
    const list = await lambda.send(
      new ListFunctionsCommand({ Marker: marker, MaxItems: 50 })
    );

    for (const fn of list.Functions || []) {
      if (!fn.FunctionName?.startsWith("Kit-")) continue;

      try {
        await lambda.send(
          new PutFunctionConcurrencyCommand({
            FunctionName: fn.FunctionName,
            ReservedConcurrentExecutions: 0,
          })
        );
        killed.push(fn.FunctionName);
        console.log(`[KillSwitch] ✓ Killed: ${fn.FunctionName}`);
      } catch (err: any) {
        console.error(`[KillSwitch] ✗ Failed to kill ${fn.FunctionName}: ${err.message}`);
      }
    }

    marker = list.NextMarker;
  } while (marker);

  console.log(`[KillSwitch] Done. Killed ${killed.length} functions: ${killed.join(", ")}`);
};
