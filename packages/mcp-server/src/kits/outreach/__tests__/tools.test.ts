import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createKitTestDb } from "../../../test/create-kit-test-db";
import { migrationSql } from "../migrations";
import { sequences, emails, prospects } from "../schema";
import { createKitHandler } from "../../../framework";
import outreachKit from "../index";
import type { KitToolInvocation } from "../../../framework/types";

let db: Awaited<ReturnType<typeof createKitTestDb>>;
let handler: ReturnType<typeof createKitHandler>;

vi.mock("../../../framework/kit-db", () => ({
  createKitDbClient: () => db,
}));

beforeEach(async () => {
  db = await createKitTestDb(migrationSql);
  handler = createKitHandler(outreachKit);
});

function invoke(toolName: string, args: Record<string, unknown> = {}): KitToolInvocation {
  return { toolName, args, userId: "user-1", kitId: "cold-outreach", dbUrl: ":memory:", dbToken: "" };
}

// --- Sequences ---

describe("create_sequence", () => {
  it("creates a sequence", async () => {
    const result = await handler(invoke("create_sequence", { name: "Series A Founders", targetPersona: "VP Engineering", tone: "conversational" }));
    expect(result.content[0].text).toContain("Series A Founders");
    expect(result.content[0].text).toContain("draft");

    const all = await db.select().from(sequences);
    expect(all).toHaveLength(1);
    expect(all[0].targetPersona).toBe("VP Engineering");
    expect(all[0].tone).toBe("conversational");
  });
});

describe("list_sequences", () => {
  it("lists sequences", async () => {
    await handler(invoke("create_sequence", { name: "Seq A" }));
    await handler(invoke("create_sequence", { name: "Seq B" }));
    const result = await handler(invoke("list_sequences"));
    expect(result.content[0].text).toContain("2 sequence(s)");
  });

  it("filters by status", async () => {
    await handler(invoke("create_sequence", { name: "Draft Seq", status: "draft" }));
    await handler(invoke("create_sequence", { name: "Active Seq", status: "active" }));
    const result = await handler(invoke("list_sequences", { status: "active" }));
    expect(result.content[0].text).toContain("Active Seq");
    expect(result.content[0].text).not.toContain("Draft Seq");
  });

  it("returns empty message when no sequences", async () => {
    const result = await handler(invoke("list_sequences"));
    expect(result.content[0].text).toContain("No sequences found");
  });
});

// --- Emails ---

describe("generate_emails", () => {
  it("adds emails to a sequence", async () => {
    await handler(invoke("create_sequence", { name: "Test Seq" }));
    const allSeqs = await db.select().from(sequences);
    const seqId = allSeqs[0].id;

    const result = await handler(invoke("generate_emails", {
      sequenceId: seqId,
      emails: [
        { subject: "Quick question", body: "Hi {{name}}, saw your post about...", delayDays: 0 },
        { subject: "Following up", body: "Just checking in...", delayDays: 3 },
        { subject: "Last one", body: "Breakup email...", delayDays: 7 },
      ],
    }));
    expect(result.content[0].text).toContain("3 email(s)");
    expect(result.content[0].text).toContain("Test Seq");

    const allEmails = await db.select().from(emails);
    expect(allEmails).toHaveLength(3);
    expect(allEmails[0].position).toBe(1);
    expect(allEmails[1].position).toBe(2);
    expect(allEmails[2].position).toBe(3);
    expect(allEmails[1].delayDays).toBe(3);
  });

  it("returns error for nonexistent sequence", async () => {
    const result = await handler(invoke("generate_emails", { sequenceId: "nope", emails: [{ subject: "Hi", body: "Test" }] }));
    expect(result.isError).toBe(true);
  });

  it("appends to existing emails", async () => {
    await handler(invoke("create_sequence", { name: "Seq" }));
    const allSeqs = await db.select().from(sequences);
    const seqId = allSeqs[0].id;

    await handler(invoke("generate_emails", { sequenceId: seqId, emails: [{ subject: "First", body: "Body 1" }] }));
    await handler(invoke("generate_emails", { sequenceId: seqId, emails: [{ subject: "Second", body: "Body 2" }] }));

    const allEmails = await db.select().from(emails);
    expect(allEmails).toHaveLength(2);
    expect(allEmails.find((e: any) => e.subject === "Second")!.position).toBe(2);
  });
});

describe("edit_email", () => {
  it("edits an email subject and body", async () => {
    await handler(invoke("create_sequence", { name: "Seq" }));
    const allSeqs = await db.select().from(sequences);
    const seqId = allSeqs[0].id;

    await handler(invoke("generate_emails", { sequenceId: seqId, emails: [{ subject: "Old subject", body: "Old body" }] }));
    const allEmails = await db.select().from(emails);
    const emailId = allEmails[0].id;

    const result = await handler(invoke("edit_email", { emailId, subject: "New subject", body: "New body" }));
    expect(result.content[0].text).toContain("updated");

    const updated = await db.select().from(emails).where(eq(emails.id, emailId));
    expect(updated[0].subject).toBe("New subject");
    expect(updated[0].body).toBe("New body");
  });

  it("returns error for nonexistent email", async () => {
    const result = await handler(invoke("edit_email", { emailId: "nope", subject: "Test" }));
    expect(result.isError).toBe(true);
  });

  it("returns message when no changes specified", async () => {
    await handler(invoke("create_sequence", { name: "Seq" }));
    const allSeqs = await db.select().from(sequences);
    await handler(invoke("generate_emails", { sequenceId: allSeqs[0].id, emails: [{ subject: "Sub", body: "Body" }] }));
    const allEmails = await db.select().from(emails);

    const result = await handler(invoke("edit_email", { emailId: allEmails[0].id }));
    expect(result.content[0].text).toContain("No changes");
  });
});

// --- Prospects ---

describe("add_prospect", () => {
  it("adds a prospect to a sequence", async () => {
    await handler(invoke("create_sequence", { name: "Seq" }));
    const allSeqs = await db.select().from(sequences);
    const seqId = allSeqs[0].id;

    const result = await handler(invoke("add_prospect", {
      sequenceId: seqId,
      name: "Jane Doe",
      company: "TechCorp",
      email: "jane@techcorp.com",
      linkedinUrl: "https://linkedin.com/in/janedoe",
    }));
    expect(result.content[0].text).toContain("Jane Doe");
    expect(result.content[0].text).toContain("TechCorp");

    const all = await db.select().from(prospects);
    expect(all).toHaveLength(1);
    expect(all[0].email).toBe("jane@techcorp.com");
    expect(all[0].linkedinUrl).toBe("https://linkedin.com/in/janedoe");
    expect(all[0].status).toBe("pending");
  });

  it("returns error for nonexistent sequence", async () => {
    const result = await handler(invoke("add_prospect", { sequenceId: "nope", name: "Jane" }));
    expect(result.isError).toBe(true);
  });
});

describe("personalize_for_prospect", () => {
  it("stores personalization hooks", async () => {
    await handler(invoke("create_sequence", { name: "Seq" }));
    const allSeqs = await db.select().from(sequences);
    const seqId = allSeqs[0].id;

    await handler(invoke("add_prospect", { sequenceId: seqId, name: "Jane Doe" }));
    const allProspects = await db.select().from(prospects);
    const prospectId = allProspects[0].id;

    const result = await handler(invoke("personalize_for_prospect", {
      prospectId,
      hooks: { recent_post: "Wrote about AI in sales", mutual_connection: "John from Acme" },
    }));
    expect(result.content[0].text).toContain("Jane Doe");
    expect(result.content[0].text).toContain("2 total");
    expect(result.content[0].text).toContain("recent_post");

    const updated = await db.select().from(prospects).where(eq(prospects.id, prospectId));
    const hooks = JSON.parse(updated[0].personalizationHooks!);
    expect(hooks.recent_post).toBe("Wrote about AI in sales");
    expect(hooks.mutual_connection).toBe("John from Acme");
  });

  it("merges with existing hooks", async () => {
    await handler(invoke("create_sequence", { name: "Seq" }));
    const allSeqs = await db.select().from(sequences);
    await handler(invoke("add_prospect", { sequenceId: allSeqs[0].id, name: "Jane" }));
    const allProspects = await db.select().from(prospects);
    const prospectId = allProspects[0].id;

    await handler(invoke("personalize_for_prospect", { prospectId, hooks: { key1: "val1" } }));
    await handler(invoke("personalize_for_prospect", { prospectId, hooks: { key2: "val2" } }));

    const updated = await db.select().from(prospects).where(eq(prospects.id, prospectId));
    const hooks = JSON.parse(updated[0].personalizationHooks!);
    expect(hooks.key1).toBe("val1");
    expect(hooks.key2).toBe("val2");
  });

  it("returns error for nonexistent prospect", async () => {
    const result = await handler(invoke("personalize_for_prospect", { prospectId: "nope", hooks: { a: "b" } }));
    expect(result.isError).toBe(true);
  });
});

// --- Export ---

describe("export_sequence", () => {
  it("exports a complete sequence", async () => {
    await handler(invoke("create_sequence", { name: "Enterprise Q2", targetPersona: "CTO", tone: "formal" }));
    const allSeqs = await db.select().from(sequences);
    const seqId = allSeqs[0].id;

    await handler(invoke("generate_emails", {
      sequenceId: seqId,
      emails: [
        { subject: "Intro", body: "Hello, I noticed...", delayDays: 0 },
        { subject: "Follow up", body: "Just circling back...", delayDays: 3 },
      ],
    }));

    await handler(invoke("add_prospect", { sequenceId: seqId, name: "Alice", company: "BigCo", email: "alice@bigco.com" }));

    const result = await handler(invoke("export_sequence", { sequenceId: seqId }));
    const text = result.content[0].text;
    expect(text).toContain("Enterprise Q2");
    expect(text).toContain("CTO");
    expect(text).toContain("formal");
    expect(text).toContain("Intro");
    expect(text).toContain("Follow up");
    expect(text).toContain("delay: 3 days");
    expect(text).toContain("Alice");
    expect(text).toContain("BigCo");
  });

  it("returns error for nonexistent sequence", async () => {
    const result = await handler(invoke("export_sequence", { sequenceId: "nope" }));
    expect(result.isError).toBe(true);
  });

  it("shows empty message when sequence has no emails", async () => {
    await handler(invoke("create_sequence", { name: "Empty Seq" }));
    const allSeqs = await db.select().from(sequences);
    const result = await handler(invoke("export_sequence", { sequenceId: allSeqs[0].id }));
    expect(result.content[0].text).toContain("No emails");
  });
});
