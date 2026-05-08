# Tool Patterns

Complete patterns for every type of tool handler in KitStack.

## Imports (every tool file)

```ts
import { defineTool, kit } from "@kitstackco/sdk";
import { z } from "zod";
import { nanoid } from "nanoid";
import { eq, like, desc, and, or, isNull } from "drizzle-orm";
// Import your tables:
import { contacts, companies } from "../schema";
```

## Write Tools

### Create (single entity)

```ts
export const addContact = defineTool({
  name: "add_contact",
  description: "Add a new contact with name, email, and optional company",
  args: z.object({
    name: z.string().describe("Contact's full name"),
    email: z.string().optional().describe("Email address"),
    company: z.string().optional().describe("Company name"),
    notes: z.string().optional().describe("Any notes about this contact"),
  }),
  handler: async (db, args) => {
    const id = `con_${nanoid()}`;
    const now = new Date().toISOString();
    await db.insert(contacts).values({
      id,
      name: args.name,
      email: args.email ?? null,
      company: args.company ?? null,
      notes: args.notes ?? null,
      createdAt: now,
      updatedAt: now,
    });
    return kit.result(
      kit.created(id, "contact", `Contact "${args.name}" added.`)
    );
  },
});
```

### Update

```ts
export const updateContact = defineTool({
  name: "update_contact",
  description: "Update a contact's details — email, company, notes, or tags",
  args: z.object({
    contactId: z.string().describe("Contact ID from add_contact or search"),
    email: z.string().optional().describe("New email address"),
    company: z.string().optional().describe("New company name"),
    notes: z.string().optional().describe("Updated notes"),
  }),
  handler: async (db, args) => {
    const [existing] = await db.select().from(contacts)
      .where(eq(contacts.id, args.contactId));
    if (!existing) return kit.notFound("contact", args.contactId);

    const updates: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (args.email !== undefined) updates.email = args.email;
    if (args.company !== undefined) updates.company = args.company;
    if (args.notes !== undefined) updates.notes = args.notes;

    await db.update(contacts).set(updates).where(eq(contacts.id, args.contactId));
    return kit.result(
      kit.updated(args.contactId, "contact", `Contact "${existing.name}" updated.`)
    );
  },
});
```

### Delete / Archive

```ts
export const archiveContact = defineTool({
  name: "archive_contact",
  description: "Archive a contact (soft delete — can be restored)",
  args: z.object({
    contactId: z.string().describe("Contact ID to archive"),
  }),
  handler: async (db, args) => {
    const [existing] = await db.select().from(contacts)
      .where(eq(contacts.id, args.contactId));
    if (!existing) return kit.notFound("contact", args.contactId);

    const now = new Date().toISOString();
    await db.update(contacts)
      .set({ archivedAt: now, updatedAt: now })
      .where(eq(contacts.id, args.contactId));
    return kit.result(
      kit.deleted(args.contactId, "contact", `Contact "${existing.name}" archived.`)
    );
  },
});
```

### Create with Foreign Key (validate parent exists)

```ts
export const addDeal = defineTool({
  name: "add_deal",
  description: "Create a new deal linked to a contact",
  args: z.object({
    title: z.string().describe("Deal name or project title"),
    contactId: z.string().describe("Contact ID from add_contact"),
    value: z.number().optional().describe("Deal value in EUR"),
    stage: z.enum(["lead", "qualified", "proposal", "negotiation", "won", "lost"])
      .optional().default("lead").describe("Pipeline stage (default: lead)"),
  }),
  handler: async (db, args) => {
    // Validate parent exists
    const [contact] = await db.select().from(contacts)
      .where(eq(contacts.id, args.contactId));
    if (!contact) return kit.notFound("contact", args.contactId);

    const id = `deal_${nanoid()}`;
    const now = new Date().toISOString();
    await db.insert(deals).values({
      id, title: args.title, contactId: args.contactId,
      value: args.value ?? null, stage: args.stage,
      createdAt: now, updatedAt: now,
    });
    return kit.result(
      kit.created(id, "deal", `Deal "${args.title}" created for ${contact.name}.`)
    );
  },
});
```

## Read Tools

### List with Optional Filter

```ts
export const listContacts = defineTool({
  name: "list_contacts",
  description: "List contacts, optionally filtered by company or tag",
  args: z.object({
    company: z.string().optional().describe("Filter by company name"),
    limit: z.number().optional().default(25).describe("Max results (default: 25)"),
  }),
  handler: async (db, args) => {
    let query = db.select().from(contacts)
      .where(isNull(contacts.archivedAt))
      .orderBy(desc(contacts.updatedAt))
      .limit(args.limit);

    if (args.company) {
      query = query.where(like(contacts.company, `%${args.company}%`));
    }

    const rows = await query;
    if (rows.length === 0) return kit.text("No contacts found.");

    const lines = rows.map(r =>
      `| ${r.name} | ${r.company ?? "—"} | ${r.email ?? "—"} |`
    );
    return kit.text(
      `| Name | Company | Email |\n|------|---------|-------|\n${lines.join("\n")}\n\n${rows.length} contact(s).`
    );
  },
});
```

### Search

```ts
export const search = defineTool({
  name: "search",
  description: "Search contacts and companies by name, email, or any keyword",
  args: z.object({
    query: z.string().describe("Search term"),
  }),
  handler: async (db, args) => {
    const q = `%${args.query}%`;
    const results = await db.select().from(contacts)
      .where(or(
        like(contacts.name, q),
        like(contacts.company, q),
        like(contacts.email, q),
      ))
      .limit(10);

    if (results.length === 0) return kit.text(`No results for "${args.query}".`);
    // Format as table...
    return kit.text(formatResults(results));
  },
});
```

### Get Single Entity (Detail View)

```ts
export const getContact = defineTool({
  name: "get_contact",
  description: "Get full details for a specific contact including recent interactions",
  args: z.object({
    contactId: z.string().describe("Contact ID"),
  }),
  load: async (db, args) => {
    const [contact] = await db.select().from(contacts)
      .where(eq(contacts.id, args.contactId));
    if (!contact) return null;

    const recentInteractions = await db.select().from(interactions)
      .where(eq(interactions.contactId, args.contactId))
      .orderBy(desc(interactions.createdAt))
      .limit(5);

    return { contact, interactions: recentInteractions };
  },
  handler: async (db, args, ctx) => {
    const data = await getContact.load(db, args, ctx);
    if (!data) return kit.notFound("contact", args.contactId);

    const c = data.contact;
    const lines = [
      `## ${c.name}`,
      c.company ? `**Company:** ${c.company}` : null,
      c.email ? `**Email:** ${c.email}` : null,
      c.role ? `**Role:** ${c.role}` : null,
    ].filter(Boolean).join("\n");

    return kit.text(lines);
  },
});
```

### Aggregate / Dashboard

```ts
export const summary = defineTool({
  name: "summary",
  description: "Show a summary dashboard with counts, totals, and recent activity",
  args: z.object({}),
  load: async (db) => {
    const contactCount = await db.select({ count: sql`count(*)` }).from(contacts);
    const dealTotal = await db.select({ sum: sql`sum(value)` }).from(deals);
    return {
      contacts: contactCount[0].count,
      dealValue: dealTotal[0].sum ?? 0,
    };
  },
  handler: async (db, args, ctx) => {
    const data = await summary.load(db, args, ctx);
    return kit.text([
      `## Dashboard`,
      `- **Contacts:** ${data.contacts}`,
      `- **Total deal value:** €${data.dealValue.toLocaleString()}`,
    ].join("\n"));
  },
});
```

## Result Helpers Quick Reference

```ts
// Writes — structured, chainable
kit.result(kit.created(id, "contact", "Contact added."))
kit.result(kit.updated(id, "deal", "Stage changed."))
kit.result(kit.deleted(id, "expense", "Expense removed."))
kit.result(fragments.map(f => kit.created(f.id, "contact", f.msg))) // batch

// Reads — plain text
kit.text("No contacts found.")
kit.text(markdownTable)
kit.json({ contacts: rows, total: rows.length })

// Errors
kit.notFound("contact", id)
kit.error("Cannot archive a deal in 'won' stage.")
kit.validationError("Start date must be before end date.")
kit.conflict("A project with that name already exists.")
```

## Registering Tools

In `kit.config.ts`:
```ts
import { addContact } from "./src/tools/add-contact";
import { listContacts } from "./src/tools/list-contacts";

export default defineKit({
  // ...
  tools: [addContact, listContacts, /* ... */],
});
```

One file per tool (or per closely related pair). Name files in kebab-case matching the tool name.
