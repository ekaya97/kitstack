# Common Fixes

The 15 most common issues found during tool iteration, with before/after code examples.

## 1. Write tool returns plain text instead of structured result

**Before (broken chaining):**
```ts
handler: async (db, args, ctx) => {
  const id = nanoid();
  await db.insert(contacts).values({ id, name: args.name });
  return kit.text(`Contact ${args.name} added.`);
}
```

**After (chainable):**
```ts
handler: async (db, args, ctx) => {
  const id = nanoid();
  await db.insert(contacts).values({ id, name: args.name });
  return kit.result(
    kit.created(id, "contact", `Contact "${args.name}" added.`)
  );
}
```

## 2. Param missing .describe()

**Before:**
```ts
args: z.object({
  contactId: z.string(),
  name: z.string(),
  value: z.number(),
})
```

**After:**
```ts
args: z.object({
  contactId: z.string().describe("Contact ID from add_contact"),
  name: z.string().describe("Deal name or project title"),
  value: z.number().describe("Deal value in EUR"),
})
```

## 3. Missing not-found handling

**Before (crashes or returns wrong data):**
```ts
handler: async (db, args, ctx) => {
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, args.contactId));
  return kit.text(`Contact: ${contact.name}`); // crashes if not found
}
```

**After:**
```ts
handler: async (db, args, ctx) => {
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, args.contactId));
  if (!contact) return kit.notFound("contact", args.contactId);
  return kit.text(`Contact: ${contact.name}`);
}
```

## 4. Vague tool description

**Before:**
```ts
defineTool({
  name: "add_deal",
  description: "Create a deal",
  // ...
})
```

**After:**
```ts
defineTool({
  name: "add_deal",
  description: "Create a new deal linked to a contact, with value, stage, and expected close date",
  // ...
})
```

## 5. No enum values for constrained fields

**Before:**
```ts
args: z.object({
  stage: z.string().describe("Deal stage"),
})
```

**After:**
```ts
args: z.object({
  stage: z.enum(["lead", "qualified", "proposal", "negotiation", "closed-won", "closed-lost"])
    .describe("Deal pipeline stage"),
})
```

## 6. Date format not specified

**Before:**
```ts
args: z.object({
  date: z.string().optional(),
})
```

**After:**
```ts
args: z.object({
  date: z.string().optional()
    .describe("Date in YYYY-MM-DD format. Defaults to today."),
})
```

## 7. Missing default value documentation

**Before:**
```ts
args: z.object({
  limit: z.number().optional().default(25),
})
```

**After:**
```ts
args: z.object({
  limit: z.number().optional().default(25)
    .describe("Maximum number of results to return (default: 25)"),
})
```

## 8. Update tool doesn't return the updated entity info

**Before:**
```ts
handler: async (db, args, ctx) => {
  await db.update(deals).set({ stage: args.stage }).where(eq(deals.id, args.dealId));
  return kit.text("Updated.");
}
```

**After:**
```ts
handler: async (db, args, ctx) => {
  const [deal] = await db.select().from(deals).where(eq(deals.id, args.dealId));
  if (!deal) return kit.notFound("deal", args.dealId);
  await db.update(deals).set({ stage: args.stage }).where(eq(deals.id, args.dealId));
  return kit.result(
    kit.updated(args.dealId, "deal", `Deal "${deal.name}" stage changed to "${args.stage}".`)
  );
}
```

## 9. List tool returns raw JSON dump

**Before:**
```ts
handler: async (db, args, ctx) => {
  const rows = await db.select().from(contacts);
  return kit.json(rows); // dumps everything, wastes tokens
}
```

**After:**
```ts
handler: async (db, args, ctx) => {
  const rows = await db.select().from(contacts).limit(args.limit ?? 25);
  if (rows.length === 0) return kit.text("No contacts found.");
  const lines = rows.map(r => `| ${r.name} | ${r.company ?? "—"} | ${r.email ?? "—"} |`);
  return kit.text(
    `| Name | Company | Email |\n|------|---------|-------|\n${lines.join("\n")}\n\n${rows.length} contact(s) found.`
  );
}
```

## 10. Kit instructions are empty

**Before:**
```ts
defineKit({
  instructions: "",
  // ...
})
```

**After:**
```ts
defineKit({
  instructions: `You are a CRM assistant. When the user mentions a person, company, or deal, use the CRM tools to manage their data.

Key behaviors:
- When the user mentions meeting someone, suggest logging an activity
- When they mention a deal or project value, suggest creating a deal
- Never show internal IDs — use names and context
- Format currency as €X,XXX.XX
- Dates should be human-readable ("March 15" not "2026-03-15")`,
  // ...
})
```

## 11. No search tool (only list-all)

**Fix:** Add a search tool that filters by the most common query field:

```ts
export const searchContacts = defineTool({
  name: "search_contacts",
  description: "Search contacts by name or company",
  args: z.object({
    query: z.string().describe("Search term — matches against name and company"),
  }),
  handler: async (db, args, ctx) => {
    const rows = await db.select().from(contacts)
      .where(or(
        like(contacts.name, `%${args.query}%`),
        like(contacts.company, `%${args.query}%`)
      ));
    if (rows.length === 0) return kit.text(`No contacts matching "${args.query}".`);
    // format as table...
  },
});
```

## 12. Related entities don't show parent info

**Before:**
```ts
// list_deals returns: | Deal Name | Value | Stage |
// Missing: which contact is this deal for?
```

**After:**
```ts
const rows = await db.select({
  id: deals.id,
  name: deals.name,
  value: deals.value,
  stage: deals.stage,
  contactName: contacts.name, // JOIN to show contact
}).from(deals)
  .leftJoin(contacts, eq(deals.contactId, contacts.id));
```

## 13. Empty list returns nothing instead of a helpful message

**Before:**
```ts
handler: async (db, args, ctx) => {
  const rows = await db.select().from(expenses);
  const lines = rows.map(r => `| ${r.date} | ${r.description} |`);
  return kit.text(lines.join("\n")); // empty string if no rows
}
```

**After:**
```ts
handler: async (db, args, ctx) => {
  const rows = await db.select().from(expenses);
  if (rows.length === 0) {
    return kit.text("No expenses recorded yet. Use add_expense to start tracking.");
  }
  // format as table...
}
```

## 14. Generic entity type in response

**Before:**
```ts
return kit.result(kit.created(id, "record", "Created."));
```

**After:**
```ts
return kit.result(kit.created(id, "contact", `Contact "${args.name}" added to ${args.company}.`));
```

## 15. ID param doesn't say which entity it references

**Before:**
```ts
args: z.object({
  id: z.string(),
})
```

**After:**
```ts
args: z.object({
  contactId: z.string().describe("Contact ID from add_contact or search_contacts"),
})
```
