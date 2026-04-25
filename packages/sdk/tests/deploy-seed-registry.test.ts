import { describe, it, expect, afterEach } from "vitest";
import { createClient } from "@libsql/client";
import { seedRegistry, type KitManifest } from "../src/deploy/seed-registry";

// Use in-memory SQLite — no mocks needed
let dbUrl: string;
let client: ReturnType<typeof createClient>;

function freshDb() {
  client = createClient({ url: ":memory:" });
  // Create the tables that seedRegistry expects
  client.executeMultiple(`
    CREATE TABLE kit_registry (
      kit_id TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      tool_description TEXT,
      input_schema TEXT,
      kit_name TEXT,
      kit_description TEXT,
      lambda_resource TEXT,
      PRIMARY KEY (kit_id, tool_name)
    );
    CREATE TABLE kit_views (
      kit_id TEXT NOT NULL,
      view_slug TEXT NOT NULL,
      view_name TEXT,
      view_description TEXT,
      height INTEGER,
      shell_s3_key TEXT,
      PRIMARY KEY (kit_id, view_slug)
    );
  `);
  // seedRegistry creates its own client from url+token, so we need a file-based approach.
  // Since we can't pass a client directly, we'll test via the actual function
  // by using a file-based SQLite database.
}

// For seedRegistry, we need an actual URL it can connect to.
// We'll use a temp file DB.
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { rmSync } from "node:fs";

const TEST_DIR = resolve(tmpdir(), `kitstack-seed-test-${Date.now()}`);
const DB_PATH = resolve(TEST_DIR, "registry.db");
import { mkdirSync } from "node:fs";

function setupDb() {
  mkdirSync(TEST_DIR, { recursive: true });
  const c = createClient({ url: `file:${DB_PATH}` });
  c.executeMultiple(`
    CREATE TABLE IF NOT EXISTS kit_registry (
      kit_id TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      tool_description TEXT,
      input_schema TEXT,
      kit_name TEXT,
      kit_description TEXT,
      lambda_resource TEXT,
      PRIMARY KEY (kit_id, tool_name)
    );
    CREATE TABLE IF NOT EXISTS kit_views (
      kit_id TEXT NOT NULL,
      view_slug TEXT NOT NULL,
      view_name TEXT,
      view_description TEXT,
      height INTEGER,
      shell_s3_key TEXT,
      PRIMARY KEY (kit_id, view_slug)
    );
  `);
  c.close();
  return `file:${DB_PATH}`;
}

afterEach(() => {
  try { rmSync(TEST_DIR, { recursive: true, force: true }); } catch {}
});

const manifest: KitManifest = {
  kitId: "crm",
  kitName: "CRM Kit",
  version: "1.0.0",
  tools: [
    { name: "add_contact", description: "Add a new contact" },
    { name: "list_contacts", description: "List all contacts" },
  ],
  views: [
    { slug: "pipeline", name: "Pipeline", description: "Deal pipeline view" },
    { slug: "contacts", name: "Contacts", description: "Contact list view" },
  ],
  migrationSql: "",
};

describe("seedRegistry", () => {
  it("inserts tools into kit_registry", async () => {
    const url = setupDb();
    await seedRegistry({ tursoUrl: url, tursoToken: "", manifest });

    const c = createClient({ url });
    const result = await c.execute("SELECT * FROM kit_registry ORDER BY tool_name");
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].tool_name).toBe("add_contact");
    expect(result.rows[1].tool_name).toBe("list_contacts");
    expect(result.rows[0].kit_id).toBe("crm");
    c.close();
  });

  it("inserts views into kit_views", async () => {
    const url = setupDb();
    await seedRegistry({ tursoUrl: url, tursoToken: "", manifest });

    const c = createClient({ url });
    const result = await c.execute("SELECT * FROM kit_views ORDER BY view_slug");
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].view_slug).toBe("contacts");
    expect(result.rows[1].view_slug).toBe("pipeline");
    c.close();
  });

  it("sets shellS3Key on views", async () => {
    const url = setupDb();
    await seedRegistry({
      tursoUrl: url,
      tursoToken: "",
      manifest,
      shellS3Key: "apps/kits/crm/shell.html",
    });

    const c = createClient({ url });
    const result = await c.execute("SELECT shell_s3_key FROM kit_views LIMIT 1");
    expect(result.rows[0].shell_s3_key).toBe("apps/kits/crm/shell.html");
    c.close();
  });

  it("sets lambdaResource on tools", async () => {
    const url = setupDb();
    await seedRegistry({
      tursoUrl: url,
      tursoToken: "",
      manifest,
      lambdaResource: "Kit-crm",
    });

    const c = createClient({ url });
    const result = await c.execute("SELECT lambda_resource FROM kit_registry LIMIT 1");
    expect(result.rows[0].lambda_resource).toBe("Kit-crm");
    c.close();
  });

  it("is idempotent (INSERT OR REPLACE)", async () => {
    const url = setupDb();
    await seedRegistry({ tursoUrl: url, tursoToken: "", manifest });
    await seedRegistry({ tursoUrl: url, tursoToken: "", manifest }); // second run

    const c = createClient({ url });
    const tools = await c.execute("SELECT COUNT(*) as cnt FROM kit_registry");
    expect(tools.rows[0].cnt).toBe(2); // not 4
    const views = await c.execute("SELECT COUNT(*) as cnt FROM kit_views");
    expect(views.rows[0].cnt).toBe(2); // not 4
    c.close();
  });

  it("uses default height of 400", async () => {
    const url = setupDb();
    await seedRegistry({ tursoUrl: url, tursoToken: "", manifest });

    const c = createClient({ url });
    const result = await c.execute("SELECT height FROM kit_views LIMIT 1");
    expect(result.rows[0].height).toBe(400);
    c.close();
  });
});
