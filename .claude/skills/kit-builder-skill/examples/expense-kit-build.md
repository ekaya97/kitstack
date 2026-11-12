# Example: Building an Expense Tracker Kit

## Phase 1: Requirements

**User:** "I want a kit that tracks my business expenses. I'm a freelancer in Germany."

**Spec Interview (abbreviated):**
- **What it does:** Track business expenses with categories and VAT for quarterly Steuerberater prep
- **Entities:** expenses, quarterly summaries (derived, not stored)
- **Main workflow:** Add expense → list by category → generate quarterly summary → export
- **Domain rules:** SKR03 categories, VAT rates (19%, 7%, 0%), Kleinunternehmer option
- **Views:** Maybe a category breakdown dashboard later

**Approved Spec:**
- Kit ID: `expense`
- 1 entity: `expenses` (description, amount, category, vat_rate, date)
- 7 tools: add, list, update, delete, categorize, quarterly_summary, export
- No views for v1

## Phase 2: Scaffold & Schema

```bash
npx kitstack init expense
cd expense
npm install
```

### src/schema.ts

```ts
import { sqliteTable, text, real, integer, index } from "drizzle-orm/sqlite-core";

export const expenses = sqliteTable("expenses", {
  id: text("id").primaryKey(),
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  vatRate: real("vat_rate").notNull().default(19),
  amountNet: real("amount_net"),
  vatAmount: real("vat_amount"),
  category: text("category").notNull(),
  date: text("date").notNull(),
  receiptNote: text("receipt_note"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("idx_expenses_category").on(table.category),
  index("idx_expenses_date").on(table.date),
]);

export const schema = { expenses };
```

## Phase 3: Tools

### src/tools/add-expense.ts

```ts
import { defineTool, kit } from "@kitstackco/sdk";
import { z } from "zod";
import { nanoid } from "nanoid";
import { expenses } from "../schema";

export const addExpense = defineTool({
  name: "add_expense",
  description: "Record a new business expense with amount, category, and VAT rate",
  args: z.object({
    description: z.string().describe("What the expense is for"),
    amount: z.number().positive().describe("Gross amount in EUR"),
    category: z.enum([
      "travel", "software", "office", "meals",
      "marketing", "professional-services", "other"
    ]).describe("Expense category"),
    vat_rate: z.number().optional().default(19)
      .describe("VAT rate: 19 (standard), 7 (reduced), 0 (exempt). Default: 19"),
    date: z.string().optional()
      .describe("Date in YYYY-MM-DD format. Defaults to today."),
    receipt_note: z.string().optional()
      .describe("Note about the receipt (e.g., 'photo in Google Drive')"),
  }),
  handler: async (db, args) => {
    const id = `exp_${nanoid()}`;
    const now = new Date().toISOString();
    const date = args.date ?? now.slice(0, 10);
    const vatRate = args.vat_rate;
    const amountNet = args.amount / (1 + vatRate / 100);
    const vatAmount = args.amount - amountNet;

    await db.insert(expenses).values({
      id,
      description: args.description,
      amount: args.amount,
      vatRate,
      amountNet: Math.round(amountNet * 100) / 100,
      vatAmount: Math.round(vatAmount * 100) / 100,
      category: args.category,
      date,
      receiptNote: args.receipt_note ?? null,
      createdAt: now,
      updatedAt: now,
    });

    return kit.result(
      kit.created(id, "expense",
        `Expense recorded: ${args.description} — €${args.amount.toFixed(2)} (${args.category}, ${vatRate}% VAT)`)
    );
  },
});
```

### src/tools/list-expenses.ts

```ts
export const listExpenses = defineTool({
  name: "list_expenses",
  description: "List expenses, optionally filtered by category or date range",
  args: z.object({
    category: z.string().optional().describe("Filter by category"),
    from: z.string().optional().describe("Start date (YYYY-MM-DD)"),
    to: z.string().optional().describe("End date (YYYY-MM-DD)"),
    limit: z.number().optional().default(25).describe("Max results (default: 25)"),
  }),
  handler: async (db, args) => {
    const conditions = [];
    if (args.category) conditions.push(eq(expenses.category, args.category));
    if (args.from) conditions.push(gte(expenses.date, args.from));
    if (args.to) conditions.push(lte(expenses.date, args.to));

    const rows = await db.select().from(expenses)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(expenses.date))
      .limit(args.limit);

    if (rows.length === 0) return kit.text("No expenses found.");

    const lines = rows.map(r =>
      `| ${r.date} | ${r.description} | €${r.amount.toFixed(2)} | ${r.category} | ${r.vatRate}% |`
    );
    const total = rows.reduce((s, r) => s + r.amount, 0);

    return kit.text(
      `| Date | Description | Amount | Category | VAT |\n` +
      `|------|-------------|--------|----------|-----|\n` +
      `${lines.join("\n")}\n\n` +
      `**${rows.length} expense(s), total: €${total.toFixed(2)}**`
    );
  },
});
```

### src/tools/quarterly-summary.ts (abbreviated)

```ts
export const quarterlySummary = defineTool({
  name: "quarterly_summary",
  description: "Generate quarterly expense summary with category breakdown and VAT totals",
  args: z.object({
    year: z.number().describe("Year (e.g., 2026)"),
    quarter: z.number().min(1).max(4).describe("Quarter (1-4)"),
  }),
  handler: async (db, args) => {
    // Query expenses in date range, group by category, sum amounts
    // Show: category | count | net | VAT | gross
    // Total row at bottom
    // Kleinunternehmer notice if all VAT is 0%
  },
});
```

## Phase 4: Instructions

```ts
export const instructions = `## Expense Tracker

You are a bookkeeping assistant for German freelancers.

When the user mentions spending money, buying something, or receiving a receipt, suggest logging the expense.

Categories: travel, software, office, meals, marketing, professional-services, other.
VAT rates: 19% (standard), 7% (reduced: books, food), 0% (Kleinunternehmer or exempt).

Format amounts as €XX.XX. Always ask about the category if not specified.
For quarterly summaries, show Netto / USt / Brutto breakdown.
Never show expense IDs — reference by description and date.
`;
```

## Phase 5: No views for v1

Skipped — will add a category dashboard in v2 based on usage patterns.

## Phase 6: Test & Deploy

```bash
npm test   # createTestKit exercises: add → list → summary → update → delete
npx kitstack build
npx kitstack publish
```

Then run the Tool Iterator: "test my kit" for quality assessment.
