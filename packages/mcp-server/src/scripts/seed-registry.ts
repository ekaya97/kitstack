import { zodToJsonSchema } from "../shared/zod-to-json-schema";
import { putRegistryItem } from "../framework/dynamo";
import { Resource } from "sst";
import type { KitDefinition, KitRegistryItem } from "../framework/types";

// Import all kit definitions
import meetingKit from "../kits/meeting/index";
import crmKit from "../kits/crm/index";
import expenseKit from "../kits/expense/index";
import outreachKit from "../kits/outreach/index";

// Kit ID → SST Resource name mapping
const KIT_RESOURCE_MAP: Record<string, string> = {
  "meeting-action-tracker": "KitMeeting",
  crm: "KitCrm",
  "expense-tax-prep": "KitExpense",
  "cold-outreach": "KitOutreach",
};

function getArn(kitId: string): string {
  const resourceName = KIT_RESOURCE_MAP[kitId];
  if (!resourceName) throw new Error(`No resource mapping for kit: ${kitId}`);
  const fn = Resource[resourceName];
  if (!fn?.arn) throw new Error(`Resource ${resourceName} not linked or missing ARN`);
  return fn.arn;
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
