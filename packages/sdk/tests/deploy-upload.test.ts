import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { uploadKitBundle } from "../src/deploy/upload";

const s3Mock = mockClient(S3Client);
const TEST_DIR = resolve(tmpdir(), `kitstack-upload-test-${Date.now()}`);
const BUILD_DIR = resolve(TEST_DIR, ".kitstack/build");

function setupBuildDir(files: Record<string, string>) {
  for (const [path, content] of Object.entries(files)) {
    const full = resolve(BUILD_DIR, path);
    mkdirSync(resolve(full, ".."), { recursive: true });
    writeFileSync(full, content);
  }
}

beforeEach(() => {
  s3Mock.reset();
  s3Mock.on(PutObjectCommand).resolves({});
});

afterEach(() => {
  try { rmSync(TEST_DIR, { recursive: true, force: true }); } catch {}
});

describe("uploadKitBundle", () => {
  it("uploads server bundle to bundles/{kitId}/kit.mjs", async () => {
    setupBuildDir({ "kit.zip": "zipdata" });
    await uploadKitBundle({ buildDir: BUILD_DIR, kitId: "crm", bucketName: "test-bucket" });

    const calls = s3Mock.commandCalls(PutObjectCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0].input.Key).toBe("bundles/crm/kit.zip");
    expect(calls[0].args[0].input.Bucket).toBe("test-bucket");
    expect(calls[0].args[0].input.ContentType).toBe("application/zip");
  });

  it("uploads manifest to bundles/{kitId}/manifest.json", async () => {
    setupBuildDir({ "manifest.json": "{}" });
    await uploadKitBundle({ buildDir: BUILD_DIR, kitId: "crm", bucketName: "b" });

    const calls = s3Mock.commandCalls(PutObjectCommand);
    expect(calls[0].args[0].input.Key).toBe("bundles/crm/manifest.json");
    expect(calls[0].args[0].input.ContentType).toBe("application/json");
  });

  it("uploads shell HTML to apps/kits/{kitId}/shell.html", async () => {
    setupBuildDir({ "shell.html": "<html></html>" });
    await uploadKitBundle({ buildDir: BUILD_DIR, kitId: "crm", bucketName: "b" });

    const calls = s3Mock.commandCalls(PutObjectCommand);
    expect(calls[0].args[0].input.Key).toBe("apps/kits/crm/shell.html");
    expect(calls[0].args[0].input.ContentType).toBe("text/html");
  });

  it("uploads view files to apps/kits/{kitId}/", async () => {
    setupBuildDir({
      "views/pipeline.js": "export {}",
      "views/style.css": "body {}",
    });
    await uploadKitBundle({ buildDir: BUILD_DIR, kitId: "crm", bucketName: "b" });

    const keys = s3Mock.commandCalls(PutObjectCommand).map(c => c.args[0].input.Key);
    expect(keys).toContain("apps/kits/crm/pipeline.js");
    expect(keys).toContain("apps/kits/crm/style.css");
  });

  it("returns the count of uploaded files", async () => {
    setupBuildDir({
      "kit.zip": "zipdata",
      "manifest.json": "{}",
      "shell.html": "<html>",
    });
    const count = await uploadKitBundle({ buildDir: BUILD_DIR, kitId: "test", bucketName: "b" });
    expect(count).toBe(3);
  });

  it("returns 0 when build dir is empty", async () => {
    mkdirSync(BUILD_DIR, { recursive: true });
    const count = await uploadKitBundle({ buildDir: BUILD_DIR, kitId: "test", bucketName: "b" });
    expect(count).toBe(0);
  });

  it("sets Cache-Control header", async () => {
    setupBuildDir({ "kit.zip": "zipdata" });
    await uploadKitBundle({
      buildDir: BUILD_DIR,
      kitId: "crm",
      bucketName: "b",
      cacheControl: "max-age=31536000",
    });

    const call = s3Mock.commandCalls(PutObjectCommand)[0];
    expect(call.args[0].input.CacheControl).toBe("max-age=31536000");
  });

  it("uses no-cache by default", async () => {
    setupBuildDir({ "kit.zip": "zipdata" });
    await uploadKitBundle({ buildDir: BUILD_DIR, kitId: "crm", bucketName: "b" });

    const call = s3Mock.commandCalls(PutObjectCommand)[0];
    expect(call.args[0].input.CacheControl).toContain("no-cache");
  });
});
