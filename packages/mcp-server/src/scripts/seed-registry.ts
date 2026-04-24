import { zodToJsonSchema } from "../shared/zod-to-json-schema";
import { putRegistryItem } from "../framework/dynamo";
import type { KitDefinition, KitRegistryItem } from "../framework/types";

// Import all kit definitions
import meetingKit from "../kits/meeting/index";
import crmKit from "../kits/crm/index";
import expenseKit from "../kits/expense/index";
import outreachKit from "../kits/outreach/index";

// Kit ID → Lambda ARN env var mapping
const KIT_ARN_MAP: Record<string, string> = {
  "meeting-action-tracker": "KIT_MEETING_ARN",
  crm: "KIT_CRM_ARN",
  "expense-tax-prep": "KIT_EXPENSE_ARN",
  "cold-outreach": "KIT_OUTREACH_ARN",
};

function getArn(kitId: string): string {
  const envKey = KIT_ARN_MAP[kitId];
  if (!envKey) throw new Error(`No ARN mapping for kit: ${kitId}`);
  const arn = process.env[envKey];
  if (!arn) throw new Error(`${envKey} env var not set`);
  return arn;
}

async function seedKit(kit: KitDefinition) {
  const arn = getArn(kit.id);

  // Register each tool
  for (const tool of kit.tools) {
    const item: KitRegistryItem = {
      kitId: kit.id,
      toolName: tool.name,
      toolDescription: tool.description,
      inputSchema: JSON.stringify(zodToJsonSchema(tool.args)),
      lambdaArn: arn,
      kitName: kit.name,
      kitDescription: kit.description,
    };
    await putRegistryItem(item);
    console.log(`  ✓ ${tool.name}`);
  }

  // Register the instruction meta-tool
  const instructionItem: KitRegistryItem = {
    kitId: kit.id,
    toolName: `kitstack_${kit.id}_instructions`,
    toolDescription: `Load behavioral instructions for the ${kit.name}`,
    inputSchema: JSON.stringify({ type: "object", properties: {} }),
    lambdaArn: arn,
    kitName: kit.name,
    kitDescription: kit.description,
  };
  await putRegistryItem(instructionItem);
  console.log(`  ✓ kitstack_${kit.id}_instructions`);
}

async function main() {
  const kits = [meetingKit, crmKit, expenseKit, outreachKit];

  for (const kit of kits) {
    console.log(`\nSeeding ${kit.name} (${kit.tools.length} tools)...`);
    await seedKit(kit);
  }

  console.log(`\nDone. ${kits.reduce((sum, k) => sum + k.tools.length + 1, 0)} items seeded.`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
