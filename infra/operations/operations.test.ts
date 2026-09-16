import { execFileSync, type ExecFileSyncOptions } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const operations = resolve(root, "infra/operations");
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function run(
  script: string,
  args: string[] = [],
  options: { expectFailure?: boolean; env?: NodeJS.ProcessEnv } = {},
) {
  const execOptions: ExecFileSyncOptions = {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: options.env,
  };
  try {
    const output = execFileSync("bash", [resolve(operations, script), ...args], execOptions);
    if (options.expectFailure) throw new Error(`${script} unexpectedly succeeded`);
    return { status: 0, output };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    if (!options.expectFailure) throw error;
    return {
      status: failure.status ?? 1,
      output: `${failure.stdout ?? ""}${failure.stderr ?? ""}`,
    };
  }
}

describe("T-0213 operations helpers", () => {
  it("keeps every helper syntactically valid and exposes help", () => {
    const scripts = [
      "stage-health.sh",
      "rollback-stage.sh",
      "migrate-stage.sh",
      "rotate-secrets.sh",
      "backup-restore-rehearsal.sh",
    ];
    for (const script of scripts) {
      execFileSync("bash", ["-n", resolve(operations, script)], { cwd: root });
      expect(run(script, ["--help"]).status).toBe(0);
    }
  });

  it("plans a pinned migration without creating a worktree or running deployment", () => {
    const before = execFileSync("git", ["worktree", "list", "--porcelain"], {
      cwd: root,
      encoding: "utf8",
    });
    const result = run("migrate-stage.sh", [
      "--stage", "test",
      "--ref", "HEAD",
      "--kit", "kits/debrief",
    ]);
    const after = execFileSync("git", ["worktree", "list", "--porcelain"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(result.output).toContain("Migration plan");
    expect(result.output).toContain("migration:");
    expect(result.output).toContain("Dry run only");
    expect(after).toBe(before);
  });

  it("requires explicit confirmation before rollback, migration, or restore", () => {
    expect(run("rollback-stage.sh", ["--stage", "test", "--ref", "HEAD", "--execute"], { expectFailure: true }).output)
      .toContain("--confirm-rollback");
    expect(run("migrate-stage.sh", ["--stage", "test", "--ref", "HEAD", "--kit", "kits/debrief", "--execute"], { expectFailure: true }).output)
      .toContain("--confirm-migration");
    expect(run("backup-restore-rehearsal.sh", ["--source-db", "prod", "--restore-db", "prod-restore", "--backup-file", "/tmp/kitstack-t0213-test.sql", "--execute"], { expectFailure: true }).output)
      .toContain("--confirm-restore");
  });

  it("does not call SST during an unconfirmed or dry-run secret rotation", () => {
    const envDir = mkdtempSync(resolve(tmpdir(), "kitstack-ops-test-"));
    temporaryDirectories.push(envDir);
    const binDir = resolve(envDir, "bin");
    const envFile = resolve(envDir, ".env");
    const marker = resolve(envDir, "called");
    const secret = "never-print-this-secret";
    writeFileSync(envFile, `McpJwtSecret=${secret}\n`);
    mkdirSync(binDir, { recursive: true });
    writeFileSync(resolve(binDir, "npx"), `#!/usr/bin/env bash\nprintf '%s' called > '${marker}'\nexit 99\n`);
    chmodSync(resolve(binDir, "npx"), 0o755);
    const env = { ...process.env, PATH: `${binDir}:${process.env.PATH ?? ""}` };
    const result = run("rotate-secrets.sh", ["--stage", "test", "--env-file", envFile, "--secret", "McpJwtSecret"], { env });
    expect(result.output).toContain("Dry run only");
    expect(result.output).not.toContain(secret);
    expect(() => readFileSync(marker, "utf8")).toThrow();
  });

  it("rejects unsafe migration paths and restore destinations before external work", () => {
    expect(run("migrate-stage.sh", ["--stage", "test", "--ref", "HEAD", "--kit", "../kits/debrief"], { expectFailure: true }).output)
      .toContain("repository-relative");
    const envDir = mkdtempSync(resolve(tmpdir(), "kitstack-ops-test-"));
    temporaryDirectories.push(envDir);
    const backup = resolve(envDir, "backup.sql");
    expect(run("backup-restore-rehearsal.sh", ["--source-db", "prod", "--restore-db", "prod", "--backup-file", backup], { expectFailure: true }).output)
      .toContain("source database");
    expect(run("backup-restore-rehearsal.sh", ["--source-db", "prod", "--restore-db", "prod-copy", "--backup-file", backup], { expectFailure: true }).output)
      .toContain("restore");
  });
});
