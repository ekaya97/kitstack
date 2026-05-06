export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { Resource } from "sst";
import { db } from "@/lib/db";
import { session as sessionTable } from "@/db/auth-schema";
import { log } from "@/lib/logger";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { nanoid } from "nanoid";

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
    tools: Array<{ name: string; description: string }>;
    views: Array<{ slug: string; name: string; description: string }>;
  };
  bundle: string; // base64 kit.zip
  shell?: string; // base64 shell.html
  views?: Array<{ name: string; content: string }>; // base64 view files
  previews?: Array<{ slug: string; content: string }>; // base64 preview HTML
}

async function authenticateCli(request: NextRequest): Promise<{ userId: string; email: string } | null> {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return null;

  const [row] = await db
    .select({
      userId: sessionTable.userId,
      expiresAt: sessionTable.expiresAt,
    })
    .from(sessionTable)
    .where(
      and(
        eq(sessionTable.token, token),
        eq(sessionTable.userAgent, "kitstack-cli")
      )
    )
    .limit(1);

  if (!row) return null;
  if (row.expiresAt && new Date(row.expiresAt) < new Date()) return null;

  // Look up email
  const { user: userTable } = await import("@/db/auth-schema");
  const [userRow] = await db
    .select({ email: userTable.email })
    .from(userTable)
    .where(eq(userTable.id, row.userId))
    .limit(1);

  return { userId: row.userId, email: userRow?.email || "" };
}

export async function POST(request: NextRequest) {
  // 1. Authenticate
  const auth = await authenticateCli(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized. Run: kitstack login" }, { status: 401 });
  }

  // 2. Parse payload
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

  log.info("CLI deploy started", { userId: auth.userId, kitId, tools: manifest.tools.length });

  // 3. Write artifacts to temp directory (reuse uploadKitBundle which reads from disk)
  const tempDir = resolve(tmpdir(), `kitstack-deploy-${nanoid(8)}`);
  mkdirSync(tempDir, { recursive: true });

  try {
    // Write bundle
    writeFileSync(resolve(tempDir, "kit.zip"), Buffer.from(payload.bundle, "base64"));
    writeFileSync(resolve(tempDir, "manifest.json"), JSON.stringify(manifest, null, 2));

    // Write shell
    if (payload.shell) {
      writeFileSync(resolve(tempDir, "shell.html"), Buffer.from(payload.shell, "base64"));
    }

    // Write views
    if (payload.views?.length) {
      const viewsDir = resolve(tempDir, "views");
      for (const view of payload.views) {
        const viewPath = resolve(viewsDir, view.name);
        mkdirSync(resolve(viewPath, ".."), { recursive: true });
        writeFileSync(viewPath, Buffer.from(view.content, "base64"));
      }
    }

    // Write previews
    if (payload.previews?.length) {
      const previewsDir = resolve(tempDir, "previews");
      mkdirSync(previewsDir, { recursive: true });
      for (const preview of payload.previews) {
        writeFileSync(resolve(previewsDir, `${preview.slug}.html`), Buffer.from(preview.content, "base64"));
      }
    }

    // 4. Upload to S3
    const { uploadKitBundle } = await import(
      "@kitstackco/sdk/deploy/upload" as string
    );
    await uploadKitBundle({
      buildDir: tempDir,
      kitId,
      bucketName: (Resource as any).KitAssets.name,
    });

    // 5. Seed registry
    const { seedRegistry } = await import(
      "@kitstackco/sdk/deploy/seed-registry" as string
    );

    // Build preview keys map
    const viewPreviewKeys: Record<string, string> = {};
    if (payload.previews?.length) {
      for (const p of payload.previews) {
        viewPreviewKeys[p.slug] = `apps/kits/${kitId}/previews/${p.slug}.html`;
      }
    }

    await seedRegistry({
      tursoUrl: (Resource as any).TursoDbUrl.value,
      tursoToken: (Resource as any).TursoAuthToken.value,
      manifest,
      shellS3Key: payload.shell ? `apps/kits/${kitId}/shell.html` : undefined,
      visibility: "private",
      authorId: auth.userId,
      viewPreviewKeys,
    });

    // 6. Provision Lambda
    const infra = (Resource as any).KitLambdaInfra;
    let lambdaResult: { functionName: string; created: boolean } | null = null;

    if (infra?.roleArn && infra?.layerArn) {
      const { provisionKitLambda } = await import(
        "@kitstackco/sdk/deploy/deploy-lambda" as string
      );
      lambdaResult = await provisionKitLambda({
        kitId,
        bucketName: (Resource as any).KitAssets.name,
        bundleS3Key: `bundles/${kitId}/kit.zip`,
        roleArn: infra.roleArn,
        runtimeLayerArn: infra.layerArn,
      });
    }

    // 7. Grant deployer access (authz tuples)
    const { createClient } = await import("@libsql/client");
    const tursoClient = createClient({
      url: (Resource as any).TursoDbUrl.value,
      authToken: (Resource as any).TursoAuthToken.value,
    });

    await tursoClient.execute({
      sql: `INSERT OR IGNORE INTO authz_tuples (id, subject_type, subject_id, relation, object_type, object_id)
            VALUES (?, 'user', ?, 'activator', 'kit', ?)`,
      args: [nanoid(), auth.userId, kitSlug],
    });
    await tursoClient.execute({
      sql: `INSERT OR IGNORE INTO authz_tuples (id, subject_type, subject_id, relation, object_type, object_id)
            VALUES (?, 'user', ?, 'author', 'kit', ?)`,
      args: [nanoid(), auth.userId, kitSlug],
    });
    tursoClient.close();

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
  } finally {
    // Clean up temp directory
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}
