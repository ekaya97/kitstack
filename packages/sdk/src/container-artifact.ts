import { createHmac, createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

/** Configuration for the generated, target-neutral kit container artifact. */
export interface ContainerArtifactOptions {
  kitRoot: string;
  buildDir: string;
  manifest: Record<string, any>;
  image: string;
  baseImage?: string;
  signingKey?: string;
}

export interface ContainerArtifactResult {
  contextDir: string;
  containerfile: string;
  deploymentFile: string;
  artifactFile: string;
  image: string;
  digest: string;
  signature: string | null;
}

const DEFAULT_BASE_IMAGE = "node:22-bookworm-slim";

/**
 * Emit the portable container context used by Compose, ECS/Fargate, and
 * Kubernetes adapters. The generated Containerfile is an SDK artifact;
 * kit authors never need to maintain one.
 */
export function emitContainerArtifact(
  options: ContainerArtifactOptions,
): ContainerArtifactResult {
  const { buildDir, manifest } = options;
  const contextDir = resolve(buildDir, "container");
  mkdirSync(contextDir, { recursive: true });
  mkdirSync(resolve(contextDir, "views"), { recursive: true });

  const copyRequired = (name: string) => {
    const source = resolve(buildDir, name);
    if (!existsSync(source)) {
      throw new Error(`Container artifact is missing build output: ${name}`);
    }
    copyFileSync(source, resolve(contextDir, name));
  };

  copyRequired("kit.mjs");
  copyRequired("manifest.json");

  const shellPath = resolve(buildDir, "shell.html");
  const hasShell = existsSync(shellPath);
  if (hasShell) copyFileSync(shellPath, resolve(contextDir, "shell.html"));

  const viewsSource = resolve(buildDir, "views");
  if (existsSync(viewsSource)) {
    copyDirectoryContents(viewsSource, resolve(contextDir, "views"));
  }

  const kitPackage = readPackageJson(options.kitRoot);
  const sdkVersion = String(manifest.sdkVersion ?? "0.0.0");
  const dependencies = {
    ...(kitPackage.dependencies ?? {}),
    "@kitstackco/sdk": sdkVersion,
  };
  writeFileSync(
    resolve(contextDir, "package.json"),
    JSON.stringify(
      {
        name: `${manifest.kitId}-kit-runtime`,
        private: true,
        type: "module",
        dependencies,
      },
      null,
      2,
    ) + "\n",
  );

  const runnerPath = resolve(contextDir, "runner.mjs");
  writeFileSync(runnerPath, runnerSource());

  const baseImage = options.baseImage ?? process.env.KITSTACK_BASE_IMAGE ?? DEFAULT_BASE_IMAGE;
  const containerfilePath = resolve(contextDir, "Containerfile");
  writeFileSync(containerfilePath, containerfileSource(baseImage, hasShell));

  const deploymentPath = resolve(buildDir, "kitstack.yaml");
  writeFileSync(
    deploymentPath,
    deploymentSource({
      kitId: String(manifest.kitId),
      version: String(manifest.version),
      image: options.image,
      port: 3001,
      artifact: "artifact.json",
    }),
  );

  const files = listFiles(contextDir).map((file) => ({
    file: file.slice(contextDir.length + 1),
    sha256: sha256(readFileSync(file)),
  }));
  const payload = {
    apiVersion: "kitstack.dev/v1alpha1",
    kind: "KitArtifact",
    kitId: manifest.kitId,
    version: manifest.version,
    sdkVersion: manifest.sdkVersion,
    image: options.image,
    baseImage,
    deploymentFile: "kitstack.yaml",
    files,
  };
  const canonicalPayload = JSON.stringify(payload);
  const digest = `sha256:${sha256(canonicalPayload)}`;
  const signingKey = options.signingKey ?? process.env.KITSTACK_SIGNING_KEY;
  const signature = signingKey
    ? createHmac("sha256", signingKey).update(canonicalPayload).digest("hex")
    : null;

  writeFileSync(
    resolve(buildDir, "artifact.json"),
    JSON.stringify(
      {
        ...payload,
        digest,
        signature: signature
          ? { algorithm: "hmac-sha256", value: signature }
          : null,
      },
      null,
      2,
    ) + "\n",
  );

  return {
    contextDir,
    containerfile: containerfilePath,
    deploymentFile: deploymentPath,
    artifactFile: resolve(buildDir, "artifact.json"),
    image: options.image,
    digest,
    signature,
  };
}

function readPackageJson(kitRoot: string): Record<string, any> {
  const path = resolve(kitRoot, "package.json");
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
}

function copyDirectoryContents(source: string, destination: string) {
  for (const entry of readdirSync(source)) {
    const from = resolve(source, entry);
    const to = resolve(destination, entry);
    if (statSync(from).isDirectory()) {
      mkdirSync(to, { recursive: true });
      copyDirectoryContents(from, to);
    } else {
      copyFileSync(from, to);
    }
  }
}

function listFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = resolve(directory, entry);
    if (statSync(path).isDirectory()) files.push(...listFiles(path));
    else files.push(path);
  }
  return files.sort();
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function containerfileSource(baseImage: string, hasShell: boolean): string {
  return `# Generated by kitstack build. Do not edit; it is replaced on every build.\nFROM ${baseImage}\n\nWORKDIR /app\nENV NODE_ENV=production\nENV KITSTACK_PORT=3001\n\nCOPY package.json ./\nRUN npm install --omit=dev --ignore-scripts --no-audit --no-fund\nCOPY kit.mjs manifest.json runner.mjs ./\nCOPY views ./views\n${hasShell ? "COPY shell.html ./shell.html" : "# This kit has no Views shell."}\n\nUSER node\nEXPOSE 3001\nHEALTHCHECK --interval=30s --timeout=5s --start-period=5s CMD node -e \"fetch('http://127.0.0.1:3001/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))\"\nCMD [\"node\", \"runner.mjs\"]\n`;
}

interface DeploymentSourceOptions {
  kitId: string;
  version: string;
  image: string;
  port: number;
  artifact: string;
}

function deploymentSource(options: DeploymentSourceOptions): string {
  const service = yamlName(options.kitId);
  return `# Generated by kitstack build. This single file is compatible with\n# Docker Compose locally and is the source manifest for ECS/Fargate and\n# Kubernetes adapters.\nservices:\n  ${service}:\n    image: ${yamlScalar(options.image)}\n    build:\n      context: ./container\n      dockerfile: Containerfile\n    ports:\n      - \"${options.port}:${options.port}\"\n    environment:\n      KITSTACK_PORT: \"${options.port}\"\n      KITSTACK_DB_URL: \${KITSTACK_DB_URL:-}\n      KITSTACK_DB_TOKEN: \${KITSTACK_DB_TOKEN:-}\n    restart: unless-stopped\n    healthcheck:\n      test: [\"CMD\", \"node\", \"-e\", \"fetch('http://127.0.0.1:${options.port}/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))\"]\n      interval: 30s\n      timeout: 5s\n      retries: 3\n    x-kitstack:\n      apiVersion: kitstack.dev/v1alpha1\n      kind: KitDeployment\n      kitId: ${yamlScalar(options.kitId)}\n      version: ${yamlScalar(options.version)}\n      artifact: ${yamlScalar(options.artifact)}\n      fargate:\n        cpu: 256\n        memory: 512\n      kubernetes:\n        replicas: 1\n`;
}

function yamlName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase();
}

function yamlScalar(value: string): string {
  return JSON.stringify(value);
}

function runnerSource(): string {
  return `import { createServer } from "node:http";\nimport { readFileSync } from "node:fs";\nimport { handler } from "./kit.mjs";\n\nconst manifest = JSON.parse(readFileSync(new URL("./manifest.json", import.meta.url), "utf8"));\nconst port = Number(process.env.KITSTACK_PORT ?? 3001);\n\nconst server = createServer(async (request, response) => {\n  if (request.method === "GET" && request.url === "/healthz") {\n    response.writeHead(200, { "content-type": "application/json" });\n    response.end(JSON.stringify({ status: "ok", kitId: manifest.kitId, version: manifest.version }));\n    return;\n  }\n\n  if (request.method !== "POST" || (request.url !== "/" && request.url !== "/invoke")) {\n    response.writeHead(404);\n    response.end();\n    return;\n  }\n\n  try {\n    const body = await readBody(request);\n    const event = {\n      ...body,\n      kitId: body.kitId ?? manifest.kitId,\n      userId: body.userId ?? "default-user",\n      dbUrl: body.dbUrl ?? process.env.KITSTACK_DB_URL,\n      dbToken: body.dbToken ?? process.env.KITSTACK_DB_TOKEN,\n    };\n    const result = await handler(event);\n    response.writeHead(200, { "content-type": "application/json" });\n    response.end(JSON.stringify(result));\n  } catch (error) {\n    response.writeHead(400, { "content-type": "application/json" });\n    response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Invalid invocation" }));\n  }\n});\n\nserver.listen(port, "0.0.0.0", () => {\n  console.log(\`KitStack kit \${manifest.kitId} \${manifest.version} listening on \${port}\`);\n});\n\nfunction readBody(request) {\n  return new Promise((resolve, reject) => {\n    let data = "";\n    request.setEncoding("utf8");\n    request.on("data", chunk => { data += chunk; });\n    request.on("end", () => {\n      try { resolve(data ? JSON.parse(data) : {}); }\n      catch { reject(new Error("Request body must be JSON")); }\n    });\n    request.on("error", reject);\n  });\n}\n`;
}
