import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createKitTestDb } from "../../../test/create-kit-test-db";
import { migrationSql } from "../migrations";
import { contacts, deals, activities, proposals } from "../schema";
import { createKitHandler } from "../../../framework";
import crmKit from "../index";
import type { KitToolInvocation } from "../../../framework/types";

let db: Awaited<ReturnType<typeof createKitTestDb>>;
let handler: ReturnType<typeof createKitHandler>;

vi.mock("../../../framework/kit-db", () => ({
  createKitDbClient: () => db,
}));

beforeEach(async () => {
  db = await createKitTestDb(migrationSql);
  handler = createKitHandler(crmKit);
});

function invoke(toolName: string, args: Record<string, unknown> = {}): KitToolInvocation {
  return { toolName, args, userId: "user-1", kitId: "crm", dbUrl: ":memory:", dbToken: "" };
}

// --- Contacts ---

describe("add_contact", () => {
  it("adds a contact", async () => {
    const result = await handler(invoke("add_contact", { name: "Alice Smith", company: "Acme" }));
    expect(result.content[0].text).toContain("Alice Smith");

    const all = await db.select().from(contacts);
    expect(all).toHaveLength(1);
    expect(all[0].company).toBe("Acme");
  });
});

describe("list_contacts", () => {
  it("lists contacts", async () => {
    await handler(invoke("add_contact", { name: "Alice" }));
    await handler(invoke("add_contact", { name: "Bob" }));
    const result = await handler(invoke("list_contacts"));
    expect(result.content[0].text).toContain("2 contact(s)");
  });
});

describe("search_contacts", () => {
  it("finds by name", async () => {
    await handler(invoke("add_contact", { name: "Alice Smith", company: "Acme" }));
    await handler(invoke("add_contact", { name: "Bob Jones", company: "Beta" }));
    const result = await handler(invoke("search_contacts", { query: "Alice" }));
    expect(result.content[0].text).toContain("Alice Smith");
    expect(result.content[0].text).not.toContain("Bob Jones");
  });

  it("finds by company", async () => {
    await handler(invoke("add_contact", { name: "Alice", company: "Acme Corp" }));
    const result = await handler(invoke("search_contacts", { query: "Acme" }));
    expect(result.content[0].text).toContain("Alice");
  });
});

// --- Deals ---

describe("add_deal + list_deals", () => {
  it("creates and lists deals", async () => {
    await handler(invoke("add_deal", { name: "Website Redesign", value: 15000, stage: "proposal" }));
    const result = await handler(invoke("list_deals"));
    expect(result.content[0].text).toContain("Website Redesign");
    expect(result.content[0].text).toContain("proposal");
  });

  it("filters by stage", async () => {
    await handler(invoke("add_deal", { name: "Deal A", stage: "prospect" }));
    await handler(invoke("add_deal", { name: "Deal B", stage: "won" }));
    const result = await handler(invoke("list_deals", { stage: "prospect" }));
    expect(result.content[0].text).toContain("Deal A");
    expect(result.content[0].text).not.toContain("Deal B");
  });
});

describe("update_deal", () => {
  it("updates deal stage", async () => {
    await handler(invoke("add_deal", { name: "My Deal", stage: "prospect" }));
    const allDeals = await db.select().from(deals);
    const dealId = allDeals[0].id;

    const result = await handler(invoke("update_deal", { dealId, stage: "won" }));
    expect(result.content[0].text).toContain("updated");

    const updated = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(updated[0].stage).toBe("won");
  });

  it("returns error for nonexistent deal", async () => {
    const result = await handler(invoke("update_deal", { dealId: "nope", stage: "won" }));
    expect(result.isError).toBe(true);
  });
});

// --- Activities ---

describe("add_activity", () => {
  it("logs an activity", async () => {
    await handler(invoke("add_contact", { name: "Alice" }));
    const allContacts = await db.select().from(contacts);
    const contactId = allContacts[0].id;

    const result = await handler(invoke("add_activity", {
      contactId,
      type: "call",
      description: "Discussed project timeline",
    }));
    expect(result.content[0].text).toContain("call logged");

    const all = await db.select().from(activities);
    expect(all).toHaveLength(1);
  });
});

// --- Contact Detail ---

describe("get_contact_detail", () => {
  it("shows contact with deals and activities", async () => {
    await handler(invoke("add_contact", { name: "Alice", company: "Acme", email: "alice@acme.com" }));
    const allContacts = await db.select().from(contacts);
    const contactId = allContacts[0].id;

    await handler(invoke("add_deal", { name: "Acme Website", contactId, value: 10000 }));
    await handler(invoke("add_activity", { contactId, type: "email", description: "Sent intro" }));

    const result = await handler(invoke("get_contact_detail", { contactId }));
    const text = result.content[0].text;
    expect(text).toContain("Alice");
    expect(text).toContain("Acme Website");
    expect(text).toContain("Sent intro");
  });
});

// --- Pipeline Dashboard ---

describe("pipeline_dashboard", () => {
  it("shows pipeline summary", async () => {
    await handler(invoke("add_deal", { name: "Deal 1", value: 5000, stage: "prospect" }));
    await handler(invoke("add_deal", { name: "Deal 2", value: 10000, stage: "won" }));
    const result = await handler(invoke("pipeline_dashboard"));
    const text = result.content[0].text;
    expect(text).toContain("Pipeline Dashboard");
    expect(text).toContain("prospect");
    expect(text).toContain("won");
  });

  it("returns empty message when no deals", async () => {
    const result = await handler(invoke("pipeline_dashboard"));
    expect(result.content[0].text).toContain("empty");
  });
});

// --- Generate Proposal ---

describe("generate_proposal", () => {
  it("stores a proposal for a deal", async () => {
    await handler(invoke("add_deal", { name: "Big Project" }));
    const allDeals = await db.select().from(deals);
    const dealId = allDeals[0].id;

    const result = await handler(invoke("generate_proposal", {
      dealId,
      content: "# Proposal\n\nHere's our plan...",
    }));
    expect(result.content[0].text).toContain("v1");
    expect(result.content[0].text).toContain("draft");

    const all = await db.select().from(proposals);
    expect(all).toHaveLength(1);
    expect(all[0].version).toBe(1);
  });
});

// --- Export ---

describe("export", () => {
  it("exports contacts as CSV", async () => {
    await handler(invoke("add_contact", { name: "Alice", email: "alice@test.com" }));
    const result = await handler(invoke("export", { type: "contacts" }));
    expect(result.content[0].text).toContain("csv");
    expect(result.content[0].text).toContain("Alice");
  });

  it("exports deals as CSV", async () => {
    await handler(invoke("add_deal", { name: "Deal X", value: 5000 }));
    const result = await handler(invoke("export", { type: "deals" }));
    expect(result.content[0].text).toContain("csv");
    expect(result.content[0].text).toContain("Deal X");
  });
});
