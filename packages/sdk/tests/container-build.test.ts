import { createHmac } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { emitContainerArtifact } from "../src/container-artifact";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("generated kit container artifact", () => {
  it("emits one portable deployment file and a signed, versioned context", () => {
    const root = mkdtempSync(resolve(tmpdir(), "kitstack-container-test-"));
    temporaryDirectories.push(root);
    const buildDir = resolve(root, ".kitstack", "build");
    const kitRoot = resolve(root, "kit");
    const contextDir = resolve(buildDir, "container");
    mkdirSync(kitRoot, { recursive: true });
    mkdirSync(buildDir, { recursive: true });

    writeFileSync(resolve(kitRoot, "package.json"), JSON.stringify({
      dependencies: {
        "@kitstackco/sdk": "*",
        zod: "^3.22.0",
      },
    }));
    writeFileSync(resolve(buildDir, "kit.mjs"), "export const handler = async () => ({ ok: true });\n");
    writeFileSync(resolve(buildDir, "manifest.json"), JSON.stringify({
      kitId: "sales-demo",
      version: "1.2.3",
      sdkVersion: "0.2.0",
    }));

    const result = emitContainerArtifact({
      kitRoot,
      buildDir,
      manifest: { kitId: "sales-demo", version: "1.2.3", sdkVersion: "0.2.0" },
      image: "registry.example/sales-demo:1.2.3",
      baseImage: "node:22-bookworm-slim@sha256:base-pin",
      signingKey: "operator-test-key",
    });

    const containerfile = readFileSync(result.containerfile, "utf8");
    const deployment = readFileSync(result.deploymentFile, "utf8");
    const artifact = JSON.parse(readFileSync(result.artifactFile, "utf8"));
    const contextPackage = JSON.parse(readFileSync(resolve(contextDir, "package.json"), "utf8"));

    expect(containerfile).toContain("FROM node:22-bookworm-slim@sha256:base-pin");
    expect(containerfile).toContain("CMD [\"node\", \"runner.mjs\"]");
    expect(containerfile).not.toContain("COPY Dockerfile");
    expect(deployment).toContain("image: \"registry.example/sales-demo:1.2.3\"");
    expect(deployment).toContain("x-kitstack:");
    expect(deployment).toContain("fargate:");
    expect(deployment).toContain("kubernetes:");
    expect(deployment).toContain("dockerfile: Containerfile");
    expect(contextPackage.dependencies["@kitstackco/sdk"]).toBe("0.2.0");
    expect(artifact.digest).toBe(result.digest);
    expect(artifact.signature).toEqual({
      algorithm: "hmac-sha256",
      value: createHmac("sha256", "operator-test-key")
        .update(JSON.stringify({
          apiVersion: "kitstack.dev/v1alpha1",
          kind: "KitArtifact",
          kitId: "sales-demo",
          version: "1.2.3",
          sdkVersion: "0.2.0",
          image: "registry.example/sales-demo:1.2.3",
          baseImage: "node:22-bookworm-slim@sha256:base-pin",
          deploymentFile: "kitstack.yaml",
          files: artifact.files,
        }))
        .digest("hex"),
    });
  });
});
