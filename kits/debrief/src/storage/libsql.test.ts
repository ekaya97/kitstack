import { afterEach, describe, expect, it } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { createLibsqlStorageAdapter } from "./libsql.js";

let clients: Client[] = [];

afterEach(() => {
  for (const client of clients) client.close();
  clients = [];
});

describe("libSQL storage adapter", () => {
  it("executes provider-neutral SQL and stores binary objects", async () => {
    const client = createClient({ url: ":memory:" });
    clients.push(client);
    const storage = createLibsqlStorageAdapter(client, {
      scope: { orgId: "org-1", kitId: "adint", tenantId: "tenant-1" },
      now: () => "2026-09-16T12:00:00.000Z",
    });

    await storage.sql!.execute("CREATE TABLE facts (id TEXT PRIMARY KEY, value TEXT NOT NULL)");
    const result = await storage.sql!.execute({ sql: "INSERT INTO facts (id, value) VALUES (?, ?)", args: ["fact-1", "visible"] });
    expect(result.rowsAffected).toBe(1);
    await storage.sql!.execute({ sql: "INSERT INTO facts (id, value) VALUES (?, ?)", args: ["fact-2", "also-visible"] });
    await expect(storage.sql!.execute("SELECT value FROM facts ORDER BY id")).resolves.toMatchObject({
      rows: [{ value: "visible" }, { value: "also-visible" }],
    });

    const saved = await storage.objects!.put({
      key: "crawl/run-1/screenshot.png",
      body: Uint8Array.from([0, 1, 2, 255]),
      contentType: "image/png",
      metadata: { source: "adint" },
    });
    expect(saved).toMatchObject({ key: "crawl/run-1/screenshot.png", contentType: "image/png", createdAt: "2026-09-16T12:00:00.000Z" });
    expect(saved.etag).toHaveLength(64);
    await expect(storage.objects!.get(saved.key)).resolves.toMatchObject({ body: Uint8Array.from([0, 1, 2, 255]), metadata: { source: "adint" } });
    await expect(storage.objects!.list("crawl/run-1/")).resolves.toHaveLength(1);
  });

  it("enforces organization, kit, and tenant isolation for objects", async () => {
    const client = createClient({ url: ":memory:" });
    clients.push(client);
    const orgOne = createLibsqlStorageAdapter(client, { scope: { orgId: "org-1", kitId: "debrief" } });
    const orgTwo = createLibsqlStorageAdapter(client, { scope: { orgId: "org-2", kitId: "debrief" } });
    const otherKit = createLibsqlStorageAdapter(client, { scope: { orgId: "org-1", kitId: "adint" } });
    await orgOne.objects!.put({ key: "same-key", body: new TextEncoder().encode("org one") });

    await expect(orgOne.objects!.get("same-key")).resolves.not.toBeNull();
    await expect(orgTwo.objects!.get("same-key")).resolves.toBeNull();
    await expect(otherKit.objects!.get("same-key")).resolves.toBeNull();
    await expect(orgTwo.objects!.list()).resolves.toEqual([]);
  });

  it("rejects an invalid scope before binding the provider", async () => {
    const client = createClient({ url: ":memory:" });
    clients.push(client);
    expect(() => createLibsqlStorageAdapter(client, { scope: { orgId: " ", kitId: "debrief" } })).toThrow("orgId");
  });
});
