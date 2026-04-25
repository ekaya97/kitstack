import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq, isNull } from "drizzle-orm";
import { createKitTestDb } from "../../../test/create-kit-test-db";
import { migrationSql } from "../migrations";
import { expenses, quarterlySummaries, settings } from "../schema";
import { createKitHandler } from "../../../../../packages/mcp-server/src/framework";
import expenseKit from "../index";
import type { KitToolInvocation } from "../../../framework/types";
import { textOf } from "../../../test/helpers";

let db: Awaited<ReturnType<typeof createKitTestDb>>;
let handler: ReturnType<typeof createKitHandler>;

vi.mock("../../../framework/kit-db", () => ({
  createKitDbClient: () => db,
}));

beforeEach(async () => {
  db = await createKitTestDb(migrationSql);
  handler = createKitHandler(expenseKit);
});

function invoke(toolName: string, args: Record<string, unknown> = {}): KitToolInvocation {
  return { toolName, args, userId: "user-1", kitId: "expense-tax-prep", dbUrl: ":memory:", dbToken: "" };
}

// --- add_expense ---

describe("add_expense", () => {
  it("adds an expense with auto-calculated VAT", async () => {
    const result = await handler(invoke("add_expense", {
      date: "2026-01-15",
      description: "Adobe Creative Cloud",
      amountGross: 59.99,
      vatRate: 0.19,
    }));
    expect(textOf(result)).toContain("Adobe Creative Cloud");
    expect(textOf(result)).toContain("59.99");

    const all = await db.select().from(expenses);
    expect(all).toHaveLength(1);
    expect(all[0].amountGross).toBe(59.99);
    expect(all[0].vatRate).toBe(0.19);
    expect(all[0].amountNet).toBeCloseTo(50.41, 1);
    expect(all[0].vatAmount).toBeCloseTo(9.58, 1);
  });

  it("flags expenses > 250 as needing receipt", async () => {
    const result = await handler(invoke("add_expense", {
      date: "2026-02-01",
      description: "New Laptop",
      amountGross: 1299.00,
    }));
    expect(textOf(result)).toContain("receipt required");

    const all = await db.select().from(expenses);
    expect(all[0].needsReceipt).toBe(true);
  });

  it("uses default 19% VAT when not specified", async () => {
    await handler(invoke("add_expense", {
      date: "2026-03-01",
      description: "Office Supplies",
      amountGross: 100,
    }));

    const all = await db.select().from(expenses);
    expect(all[0].vatRate).toBe(0.19);
  });

  it("includes tax advice reminder", async () => {
    const result = await handler(invoke("add_expense", {
      date: "2026-01-01",
      description: "Test",
      amountGross: 10,
    }));
    expect(textOf(result)).toContain("not tax advice");
  });
});

// --- import_csv ---

describe("import_csv", () => {
  it("imports expenses from CSV text", async () => {
    const csv = `date,description,amount
15.01.2026,AWS Hosting,49.99
20.01.2026,Google Ads,150.00
25.01.2026,Office Rent,800.00`;

    const result = await handler(invoke("import_csv", { csvText: csv }));
    expect(textOf(result)).toContain("Imported 3 expense(s)");

    const all = await db.select().from(expenses);
    expect(all).toHaveLength(3);
    expect(all[0].source).toBe("csv_import");
  });

  it("handles semicolon-separated CSV (German format)", async () => {
    const csv = `datum;beschreibung;betrag
15.01.2026;Miete Buro;1.200,50
20.01.2026;Strom;89,99`;

    const result = await handler(invoke("import_csv", { csvText: csv }));
    expect(textOf(result)).toContain("Imported 2 expense(s)");

    const all = await db.select().from(expenses);
    expect(all).toHaveLength(2);
    // 1.200,50 should be parsed as 1200.50
    const rent = all.find((e) => e.description === "Miete Buro");
    expect(rent?.amountGross).toBe(1200.50);
  });

  it("returns error for invalid CSV", async () => {
    const result = await handler(invoke("import_csv", { csvText: "just a header\n" }));
    expect(result.isError).toBe(true);
  });

  it("sets all imported expenses as uncategorized", async () => {
    const csv = `date,description,amount
01.02.2026,Something,50.00`;

    await handler(invoke("import_csv", { csvText: csv }));
    const all = await db.select().from(expenses);
    expect(all[0].category).toBeNull();
  });
});

// --- list_expenses ---

describe("list_expenses", () => {
  it("lists all expenses", async () => {
    await handler(invoke("add_expense", { date: "2026-01-10", description: "Expense A", amountGross: 100 }));
    await handler(invoke("add_expense", { date: "2026-01-20", description: "Expense B", amountGross: 200 }));

    const result = await handler(invoke("list_expenses"));
    expect(textOf(result)).toContain("2 expense(s)");
    expect(textOf(result)).toContain("Expense A");
    expect(textOf(result)).toContain("Expense B");
  });

  it("filters by date range", async () => {
    await handler(invoke("add_expense", { date: "2026-01-10", description: "January", amountGross: 100 }));
    await handler(invoke("add_expense", { date: "2026-02-15", description: "February", amountGross: 200 }));

    const result = await handler(invoke("list_expenses", { startDate: "2026-02-01", endDate: "2026-02-28" }));
    expect(textOf(result)).toContain("February");
    expect(textOf(result)).not.toContain("January");
  });

  it("filters by category", async () => {
    await handler(invoke("add_expense", { date: "2026-01-01", description: "A", amountGross: 100, category: "Software" }));
    await handler(invoke("add_expense", { date: "2026-01-02", description: "B", amountGross: 200, category: "Travel" }));

    const result = await handler(invoke("list_expenses", { category: "Software" }));
    expect(textOf(result)).toContain("1 expense(s)");
    expect(textOf(result)).toContain("Software");
  });

  it("returns message when no expenses found", async () => {
    const result = await handler(invoke("list_expenses"));
    expect(textOf(result)).toContain("No expenses found");
  });
});

// --- categorize ---

describe("categorize", () => {
  it("auto-categorizes expenses by description", async () => {
    await handler(invoke("add_expense", { date: "2026-01-01", description: "AWS Cloud Hosting", amountGross: 50 }));
    await handler(invoke("add_expense", { date: "2026-01-02", description: "Google Ads Campaign", amountGross: 200 }));

    const result = await handler(invoke("categorize"));
    expect(textOf(result)).toContain("Categorized 2 of 2");

    const all = await db.select().from(expenses);
    const aws = all.find((e) => e.description === "AWS Cloud Hosting");
    expect(aws?.category).toBe("Software/Cloud");
    expect(aws?.skr03Account).toBe("4946");

    const ads = all.find((e) => e.description === "Google Ads Campaign");
    expect(ads?.category).toBe("Werbekosten");
    expect(ads?.skr03Account).toBe("4600");
  });

  it("reports items that could not be auto-categorized", async () => {
    await handler(invoke("add_expense", { date: "2026-01-01", description: "Random Thing XYZ", amountGross: 30 }));

    const result = await handler(invoke("categorize"));
    expect(textOf(result)).toContain("could not auto-categorize");
    expect(textOf(result)).toContain("manual categorization");
  });

  it("categorizes a specific expense by ID", async () => {
    await handler(invoke("add_expense", { date: "2026-01-01", description: "Miete Buro", amountGross: 800 }));
    const all = await db.select().from(expenses);
    const id = all[0].id;

    const result = await handler(invoke("categorize", { expenseId: id }));
    expect(textOf(result)).toContain("Miete");

    const updated = await db.select().from(expenses).where(eq(expenses.id, id));
    expect(updated[0].category).toBe("Miete");
    expect(updated[0].skr03Account).toBe("4210");
  });

  it("returns message when no uncategorized expenses exist", async () => {
    const result = await handler(invoke("categorize"));
    expect(textOf(result)).toContain("No uncategorized expenses");
  });
});

// --- quarterly_summary ---

describe("quarterly_summary", () => {
  it("generates a quarterly summary", async () => {
    await handler(invoke("add_expense", { date: "2026-01-15", description: "Hosting", amountGross: 100, category: "Software" }));
    await handler(invoke("add_expense", { date: "2026-02-20", description: "Ads", amountGross: 200, category: "Marketing" }));
    await handler(invoke("add_expense", { date: "2026-03-10", description: "Rent", amountGross: 800, category: "Miete" }));

    const result = await handler(invoke("quarterly_summary", { year: 2026, quarter: 1 }));
    const text = textOf(result);
    expect(text).toContain("Q1 2026 Summary");
    expect(text).toContain("1100.00");
    expect(text).toContain("Software");
    expect(text).toContain("Marketing");

    const summaries = await db.select().from(quarterlySummaries);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].year).toBe(2026);
    expect(summaries[0].quarter).toBe(1);
  });

  it("flags uncategorized expenses", async () => {
    await handler(invoke("add_expense", { date: "2026-01-15", description: "Mystery charge", amountGross: 50 }));

    const result = await handler(invoke("quarterly_summary", { year: 2026, quarter: 1 }));
    expect(textOf(result)).toContain("uncategorized");
  });

  it("returns message when no expenses in quarter", async () => {
    const result = await handler(invoke("quarterly_summary", { year: 2026, quarter: 4 }));
    expect(textOf(result)).toContain("No expenses found for Q4 2026");
  });
});

// --- export_steuerberater ---

describe("export_steuerberater", () => {
  it("exports expenses as CSV for Steuerberater", async () => {
    await handler(invoke("add_expense", {
      date: "2026-01-15",
      description: "Software License",
      amountGross: 119.00,
      category: "Software",
      skr03Account: "4946",
    }));

    const result = await handler(invoke("export_steuerberater", {
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    }));

    const text = textOf(result);
    expect(text).toContain("Steuerberater Export");
    expect(text).toContain("csv");
    expect(text).toContain("Software License");
    expect(text).toContain("4946");
    expect(text).toContain("Datum");
    expect(text).toContain("Brutto");
    expect(text).toContain("not tax advice");
  });

  it("returns message when no expenses found", async () => {
    const result = await handler(invoke("export_steuerberater", {
      startDate: "2099-01-01",
      endDate: "2099-12-31",
    }));
    expect(textOf(result)).toContain("No expenses found");
  });
});

// --- update_expense ---

describe("update_expense", () => {
  it("updates expense category and SKR03 account", async () => {
    await handler(invoke("add_expense", { date: "2026-01-15", description: "Something", amountGross: 100 }));
    const all = await db.select().from(expenses);
    const id = all[0].id;

    const result = await handler(invoke("update_expense", {
      expenseId: id,
      category: "Werbekosten",
      skr03Account: "4600",
    }));
    expect(textOf(result)).toContain("updated");

    const updated = await db.select().from(expenses).where(eq(expenses.id, id));
    expect(updated[0].category).toBe("Werbekosten");
    expect(updated[0].skr03Account).toBe("4600");
  });

  it("recalculates VAT when rate changes", async () => {
    await handler(invoke("add_expense", { date: "2026-01-01", description: "Book", amountGross: 107, vatRate: 0.19 }));
    const all = await db.select().from(expenses);
    const id = all[0].id;

    await handler(invoke("update_expense", { expenseId: id, vatRate: 0.07 }));

    const updated = await db.select().from(expenses).where(eq(expenses.id, id));
    expect(updated[0].vatRate).toBe(0.07);
    expect(updated[0].amountNet).toBeCloseTo(100, 0);
    expect(updated[0].vatAmount).toBeCloseTo(7, 0);
  });

  it("returns error for nonexistent expense", async () => {
    const result = await handler(invoke("update_expense", { expenseId: "nope", category: "Test" }));
    expect(result.isError).toBe(true);
  });

  it("returns message when no changes specified", async () => {
    await handler(invoke("add_expense", { date: "2026-01-01", description: "X", amountGross: 10 }));
    const all = await db.select().from(expenses);
    const id = all[0].id;

    const result = await handler(invoke("update_expense", { expenseId: id }));
    expect(textOf(result)).toContain("No changes");
  });
});
