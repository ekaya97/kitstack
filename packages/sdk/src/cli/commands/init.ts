import { existsSync, mkdirSync, writeFileSync } from "fs";
import { resolve, join } from "path";

export async function init(args: string[]) {
  const name = args[0];
  if (!name) {
    console.error("Usage: kitstack init <name>");
    process.exit(1);
  }

  // Validate kit name is kebab-case
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name)) {
    console.error(
      `Kit name "${name}" must be kebab-case (e.g., "my-crm-kit").`
    );
    process.exit(1);
  }

  const dir = resolve(process.cwd(), name);
  if (existsSync(dir)) {
    console.error(`Directory "${name}" already exists.`);
    process.exit(1);
  }

  console.log(`\n  Creating ${name}...\n`);

  // Create directory structure
  const dirs = [
    "",
    "src",
    "src/tools",
    "src/views",
    "src/views/dashboard",
    "test",
  ];
  for (const d of dirs) {
    mkdirSync(join(dir, d), { recursive: true });
  }

  // Convert kit name to display name: "my-crm-kit" → "My CRM Kit"
  const displayName = name
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const files: Record<string, string> = {
    "kit.config.ts": kitConfigTemplate(name, displayName),
    "package.json": packageJsonTemplate(name),
    "tsconfig.json": tsconfigTemplate(),
    "tailwind.config.ts": tailwindConfigTemplate(),
    "src/schema.ts": schemaTemplate(),
    "src/migrations.ts": migrationsTemplate(),
    "src/instructions.ts": instructionsTemplate(displayName),
    "src/tools/example.ts": exampleToolTemplate(),
    "src/views/dashboard/index.ts": viewIndexTemplate(),
    "src/views/dashboard/loader.ts": viewLoaderTemplate(),
    "src/views/dashboard/View.tsx": viewComponentTemplate(),
    "test/tools.test.ts": testTemplate(),
    ".gitignore": gitignoreTemplate(),
  };

  for (const [filePath, content] of Object.entries(files)) {
    writeFileSync(join(dir, filePath), content);
    console.log(`  \u2713 Created ${filePath}`);
  }

  console.log(`
  Next steps:
    cd ${name}
    npm install
    npx kitstack dev --stdio
`);
}

// --- Templates ---

function kitConfigTemplate(id: string, displayName: string) {
  return `import { defineKit } from "@kitstack/sdk";
import * as schema from "./src/schema";
import { migrationSql } from "./src/migrations";
import { instructions } from "./src/instructions";
import { listItems } from "./src/tools/example";
import dashboard from "./src/views/dashboard";

export default defineKit({
  id: "${id}",
  version: "0.1.0",
  name: "${displayName}",
  description: "TODO: describe what this kit does",
  schema,
  migrationSql,
  instructions,
  tools: [listItems],
  views: [dashboard],
});
`;
}

function packageJsonTemplate(name: string) {
  return `{
  "name": "${name}",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "@kitstack/sdk": "*",
    "zod": "^3.22.0",
    "drizzle-orm": "^0.38.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^2.0.0",
    "@types/react": "^19.0.0",
    "react": "^19.0.0"
  },
  "scripts": {
    "dev": "kitstack dev --stdio",
    "build": "kitstack build",
    "test": "vitest run"
  }
}
`;
}

function tsconfigTemplate() {
  return `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "."
  },
  "include": ["src", "kit.config.ts", "test"]
}
`;
}

function tailwindConfigTemplate() {
  return `import type { Config } from "tailwindcss";

export default {
  content: ["./src/views/**/*.tsx"],
  presets: [require("@kitstack/sdk/tailwind-preset")],
} satisfies Config;
`;
}

function schemaTemplate() {
  return `import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const items = sqliteTable("items", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
`;
}

function migrationsTemplate() {
  return `export const migrationSql = \`
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER
);
\`;
`;
}

function instructionsTemplate(displayName: string) {
  return `export const instructions = \`## ${displayName}

You are connected to the user's ${displayName}. Use the available tools to help them manage their data.

### Guidelines:
- Always confirm before making changes
- Show IDs in list output so the user can reference specific items
- Suggest next steps after mutations
\`;
`;
}

function exampleToolTemplate() {
  return `import { z } from "zod";
import { desc } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { defineTool, kit } from "@kitstack/sdk";
import type { KitContext } from "@kitstack/sdk";
import { items } from "../schema";

const listItemsArgs = z.object({
  limit: z.number().optional().default(25).describe("Maximum number of items to return"),
});

async function loadItems(db: LibSQLDatabase, args: z.infer<typeof listItemsArgs>, ctx: KitContext) {
  return db
    .select()
    .from(items)
    .orderBy(desc(items.createdAt))
    .limit(args.limit);
}

export const listItems = defineTool({
  name: "list_items",
  description: "List all items in the database",
  args: listItemsArgs,
  load: loadItems,

  handler: async (db, args, ctx) => {
    const result = await loadItems(db, args, ctx);
    if (result.length === 0) return kit.text("No items yet.");

    let text = \`\${result.length} item(s):\\n\\n| ID | Name | Description |\\n|----|------|-------------|\\n\`;
    for (const item of result) {
      text += \`| \\\`\${item.id}\\\` | \${item.name} | \${item.description || "\\u2014"} |\\n\`;
    }
    return kit.text(text);
  },
});
`;
}

function viewIndexTemplate() {
  return `import { defineView } from "@kitstack/sdk";
import { loader } from "./loader";
import { DashboardView } from "./View";

export default defineView({
  slug: "dashboard",
  name: "Dashboard",
  description: "for an overview of all items",
  loader,
  component: DashboardView,
  height: 400,
});
`;
}

function viewLoaderTemplate() {
  return `import { defineLoader } from "@kitstack/sdk";
import { listItems } from "../../tools/example";

export const loader = defineLoader(async (db, ctx) => {
  return listItems.load(db, { limit: 100 }, ctx);
});
`;
}

function viewComponentTemplate() {
  return `import type { Infer } from "@kitstack/sdk";
import type { loader } from "./loader";

type Data = Infer<typeof loader>;

export function DashboardView({ data }: { data: Data }) {
  return (
    <div className="p-4">
      <h1 className="font-serif text-xl mb-4">Dashboard</h1>
      <p className="text-ks-muted mb-4">{data.length} item(s)</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ks-hair">
            <th className="text-left py-1">Name</th>
            <th className="text-left py-1">Description</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.id} className="border-b border-ks-hair">
              <td className="py-1">{item.name}</td>
              <td className="py-1 text-ks-muted">{item.description || "\\u2014"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
`;
}

function testTemplate() {
  return `import { describe, it, expect, afterEach } from "vitest";
import { createTestKit } from "@kitstack/sdk/testing";
import kit from "../kit.config";

describe("tools", () => {
  const testKit = await createTestKit(kit);

  afterEach(async () => {
    await testKit.reset();
  });

  it("lists items (empty)", async () => {
    const result = await testKit.call("list_items", {});
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("No items yet");
  });
});
`;
}

function gitignoreTemplate() {
  return `.kitstack/
node_modules/
dist/
`;
}
