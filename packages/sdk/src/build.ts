import { build as esbuild } from "esbuild";
import { execSync } from "child_process";
import { createHash } from "crypto";
import {
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  statSync,
} from "fs";
import { resolve, dirname, relative, join } from "path";
import type { KitDefinition } from "./types";
import { KitStackError, MigrationError } from "./errors";
import { generateShell } from "./shell-template";

interface BuildResult {
  manifest: Record<string, unknown>;
  outputDir: string;
}

function log(icon: string, msg: string) {
  console.log(`  ${icon} ${msg}`);
}

function fail(msg: string): never {
  console.error(`\n  \u2717 ${msg}\n`);
  process.exit(1);
}

function fileHash(filePath: string): string {
  const content = readFileSync(filePath);
  return "sha256:" + createHash("sha256").update(content).digest("hex").slice(0, 12);
}

function fileSize(filePath: string): number {
  return statSync(filePath).size;
}

function fileSizeKB(filePath: string): string {
  return (fileSize(filePath) / 1024).toFixed(1);
}

export async function buildKit(kitRoot: string) {
  const configPath = resolve(kitRoot, "kit.config.ts");
  const handlerPath = resolve(kitRoot, "handler.ts");
  const outputDir = resolve(kitRoot, ".kitstack", "build");
  const entriesDir = resolve(outputDir, "_entries");
  const viewsDir = resolve(outputDir, "views");

  // ── 1. LOCATE ──────────────────────────────────────────────

  if (!existsSync(configPath)) {
    fail(`kit.config.ts not found at ${configPath}. Run from your kit's root directory.`);
  }

  // ── 2. LOAD ────────────────────────────────────────────────

  let kit: KitDefinition;
  try {
    // tsx registers itself as a TypeScript loader
    await import("tsx/esm/api");
    const module = await import(configPath);
    kit = module.default;
  } catch (e: any) {
    // Surface SDK validation errors with their code and doc URL
    if (e instanceof KitStackError) {
      fail(`${e.code}: ${e.message}\n         See: ${e.docUrl}`);
    }
    if (e.code === "MODULE_NOT_FOUND" || e.code === "ERR_MODULE_NOT_FOUND") {
      fail(`Failed to load kit.config.ts: ${e.message}\n         Run npm install first.`);
    }
    fail(`Failed to load kit.config.ts: ${e.message}`);
  }

  if (!kit || !kit.id || !kit.tools) {
    fail("kit.config.ts must export a default defineKit() call.");
  }

  log("\u2713", `Loaded kit.config.ts \u2014 "${kit.name}" (${kit.tools.length} tools, ${kit.views?.length ?? 0} views)`);

  // ── 3. VALIDATE ────────────────────────────────────────────
  // defineKit() already validated: snake_case names, description length,
  // kebab-case slugs, uniqueness, and .describe() warnings.
  // Build adds file-system checks that defineKit can't do.

  if (kit.views) {
    // Verify View.tsx exists for each view (convention: src/views/{slug}/View.tsx)
    for (const view of kit.views) {
      const viewDir = resolve(kitRoot, "src", "views", view.slug);
      const componentPath = resolve(viewDir, "View.tsx");
      if (!existsSync(componentPath)) {
        fail(`View "${view.slug}" is missing View.tsx at ${componentPath}. Each view directory must contain a View.tsx file.`);
      }
    }
  }

  // Validate migration SQL against in-memory SQLite
  if (kit.migrationSql) {
    // Split by ";" while tracking the starting line number of each statement
    const rawParts = kit.migrationSql.split(";");
    const statements: { sql: string; line: number }[] = [];
    let lineOffset = 1;
    for (const part of rawParts) {
      const trimmed = part.trim();
      if (trimmed) {
        statements.push({ sql: trimmed, line: lineOffset });
      }
      // Count newlines in this part (plus the ";" delimiter counts as same line)
      lineOffset += (part.match(/\n/g) || []).length;
    }

    // Reject DROP statements
    for (const stmt of statements) {
      const normalized = stmt.sql.replace(/--[^\n]*/g, "").trim();
      if (/^\s*DROP\s+/i.test(normalized)) {
        throw new MigrationError(
          "MIGRATION_DROP_FORBIDDEN",
          `Migration SQL contains a DROP command at line ${stmt.line}, which is forbidden. Remove destructive statements from your migration.\n         Statement: ${stmt.sql.slice(0, 120)}`
        );
      }
    }

    // Run each statement individually for precise error reporting
    try {
      const { createClient } = await import("@libsql/client");
      const client = createClient({ url: ":memory:" });
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        try {
          await client.execute(stmt.sql);
        } catch (stmtErr: any) {
          throw new MigrationError(
            "MIGRATION_SQL_INVALID",
            `Migration SQL error at statement ${i + 1} (line ${stmt.line}): ${stmtErr.message}\n         Statement: ${stmt.sql.slice(0, 120)}`
          );
        }
      }
      log("\u2713", `Migration SQL valid (${statements.length} statements)`);
    } catch (e: any) {
      if (e instanceof MigrationError) throw e;
      fail(`Migration SQL error: ${e.message}`);
    }
  }

  log("\u2713", "Validation passed");

  // ── CLEAN OUTPUT ───────────────────────────────────────────

  if (existsSync(outputDir)) {
    rmSync(outputDir, { recursive: true });
  }
  mkdirSync(entriesDir, { recursive: true });
  mkdirSync(viewsDir, { recursive: true });

  // ── 4. BUNDLE SERVER ───────────────────────────────────────

  if (!existsSync(handlerPath)) {
    fail(`handler.ts not found at ${handlerPath}. Create a handler that exports the Lambda entry point.`);
  }

  try {
    await esbuild({
      entryPoints: [handlerPath],
      bundle: true,
      format: "esm",
      platform: "node",
      target: "node22",
      outfile: resolve(outputDir, "kit.mjs"),
      external: [
        "@libsql/client",
        "drizzle-orm",
        "drizzle-orm/*",
        "zod",
      ],
      sourcemap: false,
      minify: false,
      logLevel: "silent",
    });
    log("\u2713", `Server bundle: .kitstack/build/kit.mjs (${fileSizeKB(resolve(outputDir, "kit.mjs"))} KB)`);
  } catch (e: any) {
    fail(`Server bundle failed: ${e.message}`);
  }

  // ── 5. GENERATE VIEW ENTRIES ───────────────────────────────

  if (kit.views && kit.views.length > 0) {
    for (const view of kit.views) {
      const viewDir = resolve(kitRoot, "src", "views", view.slug);
      const componentAbsolute = resolve(viewDir, "View.tsx");
      const componentRelative = relative(entriesDir, componentAbsolute).replace(/\\/g, "/");

      const entryCode = `
import { createRoot } from "react-dom/client";
import * as ViewModule from "${componentRelative}";

// Find the component: default export or first exported function
const Component = ViewModule.default || Object.values(ViewModule).find(v => typeof v === "function");

export function mount(container, data) {
  window.__KITSTACK_DATA__ = data;
  createRoot(container).render(Component ? <Component data={data} /> : null);
}

((window).__KITSTACK_VIEWS__ ??= {})["${kit.id}/${view.slug}"] = { mount };
`.trim();

      writeFileSync(resolve(entriesDir, `${view.slug}.tsx`), entryCode);
    }
    log("\u2713", `Generated ${kit.views.length} view entries`);

    // ── 6. BUNDLE VIEWS (Vite) ──────────────────────────────────

    // Generate a temporary vite config for this kit's views
    // Resolve @shared/* — find the SDK views shared directory relative to the SDK package
    const sdkDir = resolve(import.meta.dirname, "..");
    const sharedDir = resolve(sdkDir, "views", "src", "shared");
    const input: Record<string, string> = {};
    for (const view of kit.views) {
      input[`${kit.id}/${view.slug}`] = resolve(entriesDir, `${view.slug}.tsx`);
    }

    const viteConfigContent = `
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": ${JSON.stringify(sharedDir)},
    },
  },
  build: {
    outDir: ${JSON.stringify(viewsDir)},
    emptyOutDir: false,
    cssCodeSplit: false,
    rollupOptions: {
      input: ${JSON.stringify(input)},
      output: {
        format: "es",
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name][extname]",
        manualChunks(id) {
          if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/") || id.includes("node_modules/scheduler")) {
            return "vendor";
          }
          if (id.includes("src/shared/")) {
            return "shared";
          }
        },
      },
    },
  },
});
`;

    const viteConfigPath = resolve(outputDir, "_vite.config.ts");
    writeFileSync(viteConfigPath, viteConfigContent);

    try {
      execSync(
        `npx vite build --config "${viteConfigPath}"`,
        { cwd: kitRoot, stdio: "pipe" }
      );

      const viewFiles = readdirSync(viewsDir).filter((f) => f.endsWith(".js"));
      const totalSize = viewFiles.reduce((s, f) => s + fileSize(resolve(viewsDir, f)), 0);
      // Check for nested kit folder (Vite outputs to {kitId}/{view}.js)
      const kitViewDir = resolve(viewsDir, kit.id);
      if (existsSync(kitViewDir)) {
        const nestedFiles = readdirSync(kitViewDir).filter((f) => f.endsWith(".js"));
        const nestedSize = nestedFiles.reduce((s, f) => s + fileSize(resolve(kitViewDir, f)), 0);
        log("\u2713", `View bundles: ${nestedFiles.length} view modules + ${viewFiles.length} shared chunks (${((totalSize + nestedSize) / 1024).toFixed(1)} KB total)`);
      } else {
        log("\u2713", `View bundles: ${viewFiles.length} modules (${(totalSize / 1024).toFixed(1)} KB total)`);
      }
    } catch (e: any) {
      const stderr = e.stderr?.toString() || e.message;
      fail(`View bundle failed: ${stderr}`);
    }

    // ── 7. CSS (TAILWIND) ──────────────────────────────────────

    const stylesPath = resolve(kitRoot, "src", "views", "styles.css");
    const cssOutput = resolve(viewsDir, "style.css");
    const twConfig = resolve(kitRoot, "tailwind.config.ts");

    if (existsSync(stylesPath) && existsSync(twConfig)) {
      try {
        execSync(
          `npx tailwindcss -i "${stylesPath}" -o "${cssOutput}" --config "${twConfig}" --minify`,
          { cwd: kitRoot, stdio: "pipe" }
        );
        log("\u2713", `CSS: .kitstack/build/views/style.css (${fileSizeKB(cssOutput)} KB)`);
      } catch (e: any) {
        const stderr = e.stderr?.toString() || e.message;
        fail(`Tailwind CSS build failed: ${stderr}`);
      }
    }

    // ── 8. GENERATE SHELL ──────────────────────────────────────

    const platformCdn = process.env.KITSTACK_CDN || "";
    const kitCdn = process.env.KITSTACK_KIT_CDN || "";

    const shellHtml = generateShell({
      kitId: kit.id,
      platformCdn,
      kitCdn,
      views: kit.views.map((v) => ({ slug: v.slug, height: (v as any).height })),
    });

    const shellPath = resolve(outputDir, "shell.html");
    writeFileSync(shellPath, shellHtml);
    log("\u2713", `Shell: .kitstack/build/shell.html (${fileSizeKB(shellPath)} KB)`);
  }

  // ── 9. MANIFEST ────────────────────────────────────────────

  const serverBundlePath = resolve(outputDir, "kit.mjs");
  const manifest = {
    kitId: kit.id,
    kitName: kit.name,
    version: kit.version,
    sdkVersion: "0.0.1",
    tools: kit.tools.map((t) => ({
      name: t.name,
      description: t.description,
    })),
    views: (kit.views ?? []).map((v) => ({
      slug: v.slug,
      name: v.name,
      description: v.description,
    })),
    migrationSql: kit.migrationSql,
    serverBundle: {
      file: "kit.mjs",
      hash: fileHash(serverBundlePath),
      sizeBytes: fileSize(serverBundlePath),
    },
    viewModules: (kit.views ?? [])
      .map((v) => {
        const f = resolve(viewsDir, `${v.slug}.js`);
        if (!existsSync(f)) return null;
        return {
          slug: v.slug,
          file: `views/${v.slug}.js`,
          hash: fileHash(f),
          sizeBytes: fileSize(f),
        };
      })
      .filter(Boolean),
    viewCss: existsSync(resolve(viewsDir, "style.css"))
      ? {
          file: "views/style.css",
          sizeBytes: fileSize(resolve(viewsDir, "style.css")),
        }
      : null,
    shell: existsSync(resolve(outputDir, "shell.html"))
      ? {
          file: "shell.html",
          sizeBytes: fileSize(resolve(outputDir, "shell.html")),
        }
      : null,
  };

  writeFileSync(resolve(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  log("\u2713", "Manifest: .kitstack/build/manifest.json");

  console.log(`\n  Kit "${kit.name}" built successfully.\n`);

  return { manifest, outputDir };
}
