import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { init } from "../src/cli/commands/init";

describe("kitstack init", () => {
  const cwd = process.cwd();
  let dir: string | undefined;
  afterEach(() => {
    process.chdir(cwd);
    if (dir) rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("scaffolds a kit that pins this SDK and can run its own tests", async () => {
    dir = mkdtempSync(join(tmpdir(), "kitstack-init-"));
    process.chdir(dir);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    await init(["demo-kit"]);

    const pkg = JSON.parse(readFileSync(join(dir, "demo-kit/package.json"), "utf-8"));
    const sdk = JSON.parse(readFileSync(join(cwd, "package.json"), "utf-8"));
    expect(pkg.dependencies["@kitstackco/sdk"]).toBe(`^${sdk.version}`);
    // View previews and builds need these in the kit itself.
    expect(pkg.devDependencies).toHaveProperty("vite");
    expect(pkg.devDependencies).toHaveProperty("@vitejs/plugin-react");
    // Tests need migrations, which drizzle-kit generates from the schema.
    expect(pkg.scripts.test).toBe("drizzle-kit generate && vitest run");

    const test = readFileSync(join(dir, "demo-kit/test/tools.test.ts"), "utf-8");
    expect(test).toContain("beforeAll(async () =>");
    expect(test).not.toMatch(/describe\([^)]*\(\) => \{\s*const testKit = await/);

    const config = readFileSync(join(dir, "demo-kit/kit.config.ts"), "utf-8");
    expect(config).toContain("tools: [listItems, addItem]");
  });
});
