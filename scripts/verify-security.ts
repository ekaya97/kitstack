/**
 * Post-deploy security verification script.
 *
 * Run via: npx sst shell -- npx tsx scripts/verify-security.ts
 *
 * Checks all security controls are correctly configured.
 * This script MUST pass before inviting any tester.
 *
 * @module
 */

import {
  LambdaClient,
  ListFunctionsCommand,
  GetFunctionCommand,
  GetFunctionConcurrencyCommand,
} from "@aws-sdk/client-lambda";
import {
  CloudWatchClient,
  DescribeAlarmsCommand,
} from "@aws-sdk/client-cloudwatch";

const lambda = new LambdaClient({ region: "eu-central-1" });
const cloudwatch = new CloudWatchClient({ region: "eu-central-1" });

let passed = 0;
let failed = 0;

function pass(msg: string) {
  console.log(`  ✓ ${msg}`);
  passed++;
}

function fail(msg: string) {
  console.error(`  ✗ ${msg}`);
  failed++;
}

async function getKitFunctions(): Promise<string[]> {
  const names: string[] = [];
  let marker: string | undefined;
  do {
    const list = await lambda.send(
      new ListFunctionsCommand({ Marker: marker, MaxItems: 50 })
    );
    for (const fn of list.Functions || []) {
      if (fn.FunctionName?.startsWith("Kit-")) {
        names.push(fn.FunctionName);
      }
    }
    marker = list.NextMarker;
  } while (marker);
  return names;
}

async function checkLambdaConfig(functionName: string) {
  const fn = await lambda.send(
    new GetFunctionCommand({ FunctionName: functionName })
  );
  const config = fn.Configuration!;

  if ((config.Timeout ?? 0) <= 10) {
    pass(`${functionName}: timeout = ${config.Timeout}s`);
  } else {
    fail(`${functionName}: timeout = ${config.Timeout}s (expected ≤ 10)`);
  }

  if ((config.MemorySize ?? 0) <= 128) {
    pass(`${functionName}: memory = ${config.MemorySize}MB`);
  } else {
    fail(`${functionName}: memory = ${config.MemorySize}MB (expected ≤ 128)`);
  }

  // Check reserved concurrency
  try {
    const conc = await lambda.send(
      new GetFunctionConcurrencyCommand({ FunctionName: functionName })
    );
    const reserved = conc.ReservedConcurrentExecutions;
    if (reserved !== undefined && reserved <= 5) {
      pass(`${functionName}: reservedConcurrency = ${reserved}`);
    } else {
      fail(`${functionName}: reservedConcurrency = ${reserved ?? "NOT SET"} (expected ≤ 5)`);
    }
  } catch {
    fail(`${functionName}: could not read concurrency`);
  }
}

async function checkAlarms() {
  const result = await cloudwatch.send(
    new DescribeAlarmsCommand({
      AlarmNamePrefix: "kitstack-",
    })
  );

  // Also check without prefix in case SST named them differently
  const result2 = await cloudwatch.send(
    new DescribeAlarmsCommand({})
  );

  const allAlarms = [
    ...(result.MetricAlarms || []),
    ...(result2.MetricAlarms || []),
  ];

  const invocationAlarm = allAlarms.find(
    (a) => a.MetricName === "Invocations" && a.Namespace === "AWS/Lambda"
  );
  if (invocationAlarm) {
    pass(`Invocation alarm exists: ${invocationAlarm.AlarmName} (threshold: ${invocationAlarm.Threshold})`);
    if (invocationAlarm.AlarmActions?.length) {
      pass(`Invocation alarm has ${invocationAlarm.AlarmActions.length} action(s)`);
    } else {
      fail("Invocation alarm has no actions configured");
    }
  } else {
    fail("Invocation alarm NOT FOUND");
  }

  const concurrencyAlarm = allAlarms.find(
    (a) => a.MetricName === "ConcurrentExecutions" && a.Namespace === "AWS/Lambda"
  );
  if (concurrencyAlarm) {
    pass(`Concurrency alarm exists: ${concurrencyAlarm.AlarmName} (threshold: ${concurrencyAlarm.Threshold})`);
    if (concurrencyAlarm.AlarmActions?.length) {
      pass(`Concurrency alarm has ${concurrencyAlarm.AlarmActions.length} action(s)`);
    } else {
      fail("Concurrency alarm has no actions configured");
    }
  } else {
    fail("Concurrency alarm NOT FOUND");
  }
}

async function main() {
  console.log("\n🔒 KitStack Security Verification\n");

  // 1. Kit Lambda configuration
  console.log("Kit Lambda configuration:");
  const kitFunctions = await getKitFunctions();
  if (kitFunctions.length === 0) {
    console.log("  (no Kit-* functions found — skipping Lambda checks)");
  }
  for (const fn of kitFunctions) {
    await checkLambdaConfig(fn);
  }

  // 2. CloudWatch alarms
  console.log("\nCloudWatch alarms:");
  await checkAlarms();

  // 3. Kill switch Lambda
  console.log("\nKill switch:");
  try {
    await lambda.send(
      new GetFunctionCommand({ FunctionName: "KillSwitch" })
    );
    pass("Kill switch Lambda exists");
  } catch {
    // SST may name it differently — check with prefix
    try {
      const list = await lambda.send(new ListFunctionsCommand({ MaxItems: 50 }));
      const killFn = (list.Functions || []).find(
        (f) => f.FunctionName?.toLowerCase().includes("killswitch")
      );
      if (killFn) {
        pass(`Kill switch Lambda exists: ${killFn.FunctionName}`);
      } else {
        fail("Kill switch Lambda NOT FOUND");
      }
    } catch {
      fail("Kill switch Lambda NOT FOUND");
    }
  }

  // Summary
  console.log(`\n${"─".repeat(40)}`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`${"─".repeat(40)}\n`);

  if (failed > 0) {
    console.error("❌ SECURITY VERIFICATION FAILED — do NOT invite testers.\n");
    process.exit(1);
  } else {
    console.log("✅ All security checks passed.\n");
  }
}

main().catch((err) => {
  console.error("Verification script error:", err);
  process.exit(1);
});
