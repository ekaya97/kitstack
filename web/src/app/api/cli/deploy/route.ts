export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { Resource } from "sst";
import { db } from "@/lib/db";
import { session as sessionTable, user as userTable } from "@/db/auth-schema";
import { kitRegistryTable, kitViewsTable, kits } from "@/db/schema";
import { log } from "@/lib/logger";
import { nanoid } from "nanoid";
import {
  S3Client,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import {
  LambdaClient,
  GetFunctionCommand,
  CreateFunctionCommand,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand,
  PutFunctionConcurrencyCommand,
  waitUntilFunctionActiveV2,
  waitUntilFunctionUpdatedV2,
} from "@aws-sdk/client-lambda";

const s3 = new S3Client({});
const lambda = new LambdaClient({});

interface DeployPayload {
  manifest: {
    kitId: string;
    kitName: string;
    kitDescription?: string;
    kitTriggers?: string[];
    kitInstructions?: string;
    version: string;
    sdkVersion?: string;
    migrationSql?: string;
    tools: Array<{ name: string; description: string; inputSchema?: Record<string, unknown> }>;
    views: Array<{ slug: string; name: string; description: string }>;
  };
  bundle: string;
  shell?: string;
  views?: Array<{ name: string; content: string }>;
  previews?: Array<{ slug: string; content: string }>;
}

async function authenticateCli(request: NextRequest): Promise<{ userId: string; email: string; name: string } | null> {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return null;

  const [row] = await db
    .select({ userId: sessionTable.userId, expiresAt: sessionTable.expiresAt })
    .from(sessionTable)
    .where(and(eq(sessionTable.token, token), eq(sessionTable.userAgent, "kitstack-cli")))
    .limit(1);

  if (!row) return null;
  if (row.expiresAt && new Date(row.expiresAt) < new Date()) return null;

  const [userRow] = await db
    .select({ email: userTable.email, name: userTable.name })
    .from(userTable)
    .where(eq(userTable.id, row.userId))
    .limit(1);

  return { userId: row.userId, email: userRow?.email || "", name: userRow?.name || "" };
}

export async function POST(request: NextRequest) {
  const auth = await authenticateCli(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized. Run: kitstack login" }, { status: 401 });
  }

  let payload: DeployPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { manifest } = payload;
  if (!manifest?.kitId || !manifest?.tools?.length) {
    return NextResponse.json({ error: "Invalid manifest" }, { status: 400 });
  }

  const kitId = manifest.kitId;
  const kitSlug = `${kitId}-kit`;
  const bucketName = (Resource as any).KitAssets.name;

  log.info("CLI deploy started", { userId: auth.userId, kitId, tools: manifest.tools.length });

  try {
    // ── 1. Upload to S3 ─────────────────────────────────────
    const uploads: Array<{ key: string; body: Buffer; contentType: string }> = [];

    uploads.push({ key: `bundles/${kitId}/kit.zip`, body: Buffer.from(payload.bundle, "base64"), contentType: "application/zip" });
    uploads.push({ key: `bundles/${kitId}/manifest.json`, body: Buffer.from(JSON.stringify(manifest, null, 2)), contentType: "application/json" });

    if (payload.shell) {
      uploads.push({ key: `apps/kits/${kitId}/shell.html`, body: Buffer.from(payload.shell, "base64"), contentType: "text/html" });
    }

    if (payload.views) {
      for (const view of payload.views) {
        const ext = view.name.endsWith(".css") ? "text/css" : view.name.endsWith(".js") ? "application/javascript" : "application/octet-stream";
        uploads.push({ key: `apps/kits/${kitId}/${view.name}`, body: Buffer.from(view.content, "base64"), contentType: ext });
      }
    }

    if (payload.previews) {
      for (const p of payload.previews) {
        uploads.push({ key: `apps/kits/${kitId}/previews/${p.slug}.html`, body: Buffer.from(p.content, "base64"), contentType: "text/html" });
      }
    }

    for (const { key, body, contentType } of uploads) {
      await s3.send(new PutObjectCommand({
        Bucket: bucketName, Key: key, Body: body, ContentType: contentType,
        CacheControl: "max-age=0, no-cache, no-store, must-revalidate",
      }));
    }
    log.info("S3 upload complete", { kitId, files: uploads.length });

    // ── 2. Seed registry (Turso via Drizzle HTTP) ───────────
    for (const tool of manifest.tools) {
      await db.insert(kitRegistryTable).values({
        kitId,
        toolName: tool.name,
        toolDescription: tool.description,
        inputSchema: JSON.stringify(tool.inputSchema ?? {}),
        kitName: manifest.kitName,
        kitDescription: manifest.kitDescription ?? manifest.kitName,
        kitTriggers: JSON.stringify(manifest.kitTriggers ?? []),
        kitInstructions: manifest.kitInstructions ?? null,
        lambdaResource: null,
        visibility: "private",
        authorId: auth.userId,
        migrationSql: manifest.migrationSql ?? null,
      }).onConflictDoUpdate({
        target: [kitRegistryTable.kitId, kitRegistryTable.toolName],
        set: {
          toolDescription: tool.description,
          inputSchema: JSON.stringify(tool.inputSchema ?? {}),
          kitName: manifest.kitName,
          kitDescription: manifest.kitDescription ?? manifest.kitName,
          kitTriggers: JSON.stringify(manifest.kitTriggers ?? []),
          kitInstructions: manifest.kitInstructions ?? null,
          visibility: "private",
          authorId: auth.userId,
          migrationSql: manifest.migrationSql ?? null,
        },
      });
    }

    for (const view of manifest.views) {
      const previewKey = payload.previews?.find((p) => p.slug === view.slug)
        ? `apps/kits/${kitId}/previews/${view.slug}.html`
        : null;

      await db.insert(kitViewsTable).values({
        kitId,
        viewSlug: view.slug,
        viewName: view.name,
        viewDescription: view.description,
        height: 400,
        shellS3Key: payload.shell ? `apps/kits/${kitId}/shell.html` : null,
        previewS3Key: previewKey,
      }).onConflictDoUpdate({
        target: [kitViewsTable.kitId, kitViewsTable.viewSlug],
        set: {
          viewName: view.name,
          viewDescription: view.description,
          shellS3Key: payload.shell ? `apps/kits/${kitId}/shell.html` : null,
          previewS3Key: previewKey,
        },
      });
    }

    // Seed kits catalog (so the kit appears on /kits/[slug] for activation)
    await db.insert(kits).values({
      id: nanoid(),
      slug: kitSlug,
      name: manifest.kitName,
      category: "Operations" as const,
      description: manifest.kitDescription ?? manifest.kitName,
      replaces: "",
      savingsPerMonth: 0,
      mcpTools: manifest.tools,
      mcpApps: manifest.views.map((v) => ({ name: v.name, description: v.description })),
      tagline: manifest.kitDescription ?? null,
      author: auth.userId,
      status: "live" as const,
    }).onConflictDoUpdate({
      target: kits.slug,
      set: {
        name: manifest.kitName,
        description: manifest.kitDescription ?? manifest.kitName,
        mcpTools: manifest.tools,
        mcpApps: manifest.views.map((v) => ({ name: v.name, description: v.description })),
        tagline: manifest.kitDescription ?? null,
        updatedAt: new Date(),
      },
    });

    log.info("Registry seeded", { kitId, tools: manifest.tools.length, views: manifest.views.length });

    // ── 3. Provision Lambda ─────────────────────────────────
    const infra = (Resource as any).KitLambdaInfra;
    let lambdaResult: { functionName: string; created: boolean } | null = null;

    if (infra?.roleArn && infra?.layerArn) {
      const functionName = `Kit-${kitId}`;
      const bundleS3Key = `bundles/${kitId}/kit.zip`;
      let created = false;

      try {
        await lambda.send(new GetFunctionCommand({ FunctionName: functionName }));
        await waitUntilFunctionUpdatedV2({ client: lambda, maxWaitTime: 300 }, { FunctionName: functionName });
        await lambda.send(new UpdateFunctionCodeCommand({ FunctionName: functionName, S3Bucket: bucketName, S3Key: bundleS3Key }));
        await waitUntilFunctionUpdatedV2({ client: lambda, maxWaitTime: 300 }, { FunctionName: functionName });
        await lambda.send(new UpdateFunctionConfigurationCommand({
          FunctionName: functionName, MemorySize: 128, Timeout: 10,
          Layers: [infra.layerArn], Environment: { Variables: {} },
        }));
        await waitUntilFunctionUpdatedV2({ client: lambda, maxWaitTime: 300 }, { FunctionName: functionName });
      } catch (err: any) {
        if (err.name !== "ResourceNotFoundException") throw err;
        await lambda.send(new CreateFunctionCommand({
          FunctionName: functionName, Runtime: "nodejs22.x", Architectures: ["arm64"],
          Handler: "index.handler", MemorySize: 128, Timeout: 10, Role: infra.roleArn,
          Code: { S3Bucket: bucketName, S3Key: bundleS3Key },
          Layers: [infra.layerArn], Environment: { Variables: {} },
        }));
        created = true;
        await waitUntilFunctionActiveV2({ client: lambda, maxWaitTime: 60 }, { FunctionName: functionName });
      }

      await lambda.send(new PutFunctionConcurrencyCommand({ FunctionName: functionName, ReservedConcurrentExecutions: 5 }));
      lambdaResult = { functionName, created };
      log.info("Lambda provisioned", { functionName, created });
    }

    // ── 4. Grant access ─────────────────────────────────────
    const { grantRelation } = await import("@kitstackco/authz/lifecycle");
    await grantRelation(db, auth.userId, "activator", "kit", kitSlug);
    await grantRelation(db, auth.userId, "author", "kit", kitSlug);

    log.info("CLI deploy succeeded", { userId: auth.userId, kitId, lambda: lambdaResult?.functionName });

    return NextResponse.json({
      status: "deployed",
      kitId,
      kitSlug,
      visibility: "private",
      lambda: lambdaResult?.functionName ?? null,
      tools: manifest.tools.length,
      views: manifest.views.length,
    });
  } catch (err: any) {
    log.error("CLI deploy failed", { userId: auth.userId, kitId, error: err.message });
    return NextResponse.json({ error: `Deploy failed: ${err.message}` }, { status: 500 });
  }
}
