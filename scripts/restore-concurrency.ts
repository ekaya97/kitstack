/**
 * Restore Lambda concurrency after a kill switch event.
 * Run via: npx sst shell -- npx tsx scripts/restore-concurrency.ts
 */
import {
  LambdaClient,
  ListFunctionsCommand,
  PutFunctionConcurrencyCommand,
  DeleteFunctionConcurrencyCommand,
  GetFunctionConcurrencyCommand,
} from "@aws-sdk/client-lambda";

const lambda = new LambdaClient({ region: "eu-central-1" });
const KIT_CONCURRENCY = 5;

async function main() {
  console.log("\n🔧 Restoring concurrency...\n");

  const fns = await lambda.send(new ListFunctionsCommand({ MaxItems: 50 }));

  // Restore all Kit-* Lambdas
  for (const fn of fns.Functions || []) {
    if (!fn.FunctionName?.startsWith("Kit-")) continue;
    await lambda.send(new PutFunctionConcurrencyCommand({
      FunctionName: fn.FunctionName,
      ReservedConcurrentExecutions: KIT_CONCURRENCY,
    }));
    console.log(`  ✓ ${fn.FunctionName} → concurrency ${KIT_CONCURRENCY}`);
  }

  // Restore McpRouter (remove reserved = unrestricted)
  const routerFn = (fns.Functions || []).find(f =>
    f.FunctionName?.toLowerCase().includes("mcprouter")
  );
  if (routerFn?.FunctionName) {
    await lambda.send(new DeleteFunctionConcurrencyCommand({
      FunctionName: routerFn.FunctionName,
    }));
    console.log(`  ✓ ${routerFn.FunctionName} → unrestricted`);
  }

  // Verify
  console.log("\n--- Verification ---");
  for (const fn of fns.Functions || []) {
    if (!fn.FunctionName?.startsWith("Kit-") && fn.FunctionName !== routerFn?.FunctionName) continue;
    const r = await lambda.send(new GetFunctionConcurrencyCommand({ FunctionName: fn.FunctionName! }));
    console.log(`  ${fn.FunctionName}: ${r.ReservedConcurrentExecutions ?? "unrestricted"}`);
  }

  console.log("\n✅ Concurrency restored.\n");
}

main().catch(err => {
  console.error("Failed:", err.message);
  process.exit(1);
});
