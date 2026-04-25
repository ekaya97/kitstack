import { describe, it, expect, afterEach, afterAll } from "vitest";
import { createTestKit } from "@kitstackdev/kit/testing";
import crmKit from "../kit.config";
import { contacts, deals, activities } from "../src/schema";

describe("createTestKit with CRM kit", () => {
  let testKit: Awaited<ReturnType<typeof createTestKit>>;

  // createTestKit is async — vitest supports top-level await in describe
  // but we use beforeAll-like pattern via the variable
  const setup = (async () => {
    testKit = await createTestKit(crmKit);
  })();

  afterEach(async () => {
    await setup;
    await testKit.reset();
  });

  afterAll(async () => {
    await setup;
    await testKit.cleanup();
  });

  it("creates a contact via add_contact", async () => {
    await setup;
    const result = await testKit.call("add_contact", { name: "Alice Smith" });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Alice Smith");

    // Verify in DB
    const rows = await testKit.db.select().from(contacts);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Alice Smith");
  });

  it("creates a contact with all fields", async () => {
    await setup;
    const result = await testKit.call("add_contact", {
      name: "Bob Jones",
      company: "Acme Corp",
      email: "bob@acme.com",
      phone: "+1-555-0100",
      source: "LinkedIn",
      notes: "Met at conference",
    });

    expect(result.isError).toBeUndefined();

    const rows = await testKit.db.select().from(contacts);
    expect(rows).toHaveLength(1);
    expect(rows[0].company).toBe("Acme Corp");
    expect(rows[0].email).toBe("bob@acme.com");
  });

  it("lists contacts", async () => {
    await setup;
    await testKit.call("add_contact", { name: "Alice" });
    await testKit.call("add_contact", { name: "Bob" });

    const result = await testKit.call("list_contacts", {});

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Alice");
    expect(result.content[0].text).toContain("Bob");
  });

  it("returns empty state for list_contacts", async () => {
    await setup;
    const result = await testKit.call("list_contacts", {});

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("No contacts");
  });

  it("returns error for unknown tool", async () => {
    await setup;
    const result = await testKit.call("nonexistent_tool", {});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unknown tool");
  });

  it("validates arguments with Zod", async () => {
    await setup;
    // add_contact requires name (string)
    const result = await testKit.call("add_contact", {});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid arguments");
  });

  it("resets clears all data", async () => {
    await setup;
    await testKit.call("add_contact", { name: "Alice" });

    let rows = await testKit.db.select().from(contacts);
    expect(rows).toHaveLength(1);

    await testKit.reset();

    rows = await testKit.db.select().from(contacts);
    expect(rows).toHaveLength(0);
  });

  it("supports callAs with custom context", async () => {
    await setup;
    const result = await testKit.callAs(
      { userId: "custom-user-123" },
      "add_contact",
      { name: "Custom User Contact" }
    );

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Custom User Contact");
  });

  it("handles tools with load() only (list_proposals)", async () => {
    await setup;
    // list_proposals has only load(), no handler — auto-wraps with kit.json()
    const result = await testKit.call("list_proposals", {});

    expect(result.isError).toBeUndefined();
    // Should return JSON (empty array)
    const data = JSON.parse(result.content[0].text);
    expect(data).toEqual([]);
  });

  it("handles deal creation and listing", async () => {
    await setup;
    // Create a contact first (deals reference contacts)
    await testKit.call("add_contact", { name: "Alice" });
    const contactRows = await testKit.db.select().from(contacts);
    const contactId = contactRows[0].id;

    // Create a deal
    const dealResult = await testKit.call("add_deal", {
      name: "Enterprise License",
      contactId,
      value: 50000,
      stage: "proposal",
    });
    expect(dealResult.isError).toBeUndefined();

    // List deals
    const listResult = await testKit.call("list_deals", {});
    expect(listResult.isError).toBeUndefined();
    expect(listResult.content[0].text).toContain("Enterprise License");
  });

  it("handles deal stage update", async () => {
    await setup;
    await testKit.call("add_contact", { name: "Alice" });
    const contactRows = await testKit.db.select().from(contacts);

    await testKit.call("add_deal", {
      name: "Big Deal",
      contactId: contactRows[0].id,
      value: 100000,
    });
    const dealRows = await testKit.db.select().from(deals);
    const dealId = dealRows[0].id;

    const result = await testKit.call("update_deal", {
      dealId,
      stage: "won",
    });
    expect(result.isError).toBeUndefined();

    const updated = await testKit.db.select().from(deals);
    expect(updated[0].stage).toBe("won");
  });

  it("handles activity logging", async () => {
    await setup;
    await testKit.call("add_contact", { name: "Alice" });
    const contactRows = await testKit.db.select().from(contacts);

    const result = await testKit.call("add_activity", {
      contactId: contactRows[0].id,
      type: "call",
      description: "Discussed pricing",
    });
    expect(result.isError).toBeUndefined();

    const activityRows = await testKit.db.select().from(activities);
    expect(activityRows).toHaveLength(1);
    expect(activityRows[0].description).toBe("Discussed pricing");
  });
});
