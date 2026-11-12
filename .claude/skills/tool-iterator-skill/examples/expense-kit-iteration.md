# Example: Expense Kit — Iteration

## Context

A developer built an expense tracking kit for German freelancers with tools for adding, listing, categorizing, and summarizing expenses. They want to verify it works well before deploying.

## Round 1: Baseline Assessment

### Discovery

```bash
$ rm -f .kitstack/dev.db
$ kitstack call kit
KitStack — 1 app, 7 tools. expense (expenses, categories, tax). Call kit() to see all capabilities.

$ kitstack call kit expense
Available actions for expense:
  add_expense         — Record a new expense
  list_expenses       — List expenses
  categorize          — Auto-categorize an expense
  quarterly_summary   — Generate quarterly summary
  import_csv          — Import bank CSV
  update_expense      — Update expense details
  export              — Export for Steuerberater
```

### Workflow Chain 1: Add → List → Summarize

```bash
$ kitstack call kit expense add_expense '{"description":"Flight Berlin → Frankfurt","amount":189.50,"category":"travel","date":"2026-04-15"}'
✓ created expense exp_1a2b3c
Expense recorded: Flight Berlin → Frankfurt — €189.50 (travel)

$ kitstack call kit expense add_expense '{"description":"Adobe Creative Cloud","amount":65.49,"category":"software","date":"2026-04-01"}'
✓ created expense exp_4d5e6f
Expense recorded: Adobe Creative Cloud — €65.49 (software)

$ kitstack call kit expense add_expense '{"description":"Client lunch — Müller GmbH","amount":47.80,"category":"meals","date":"2026-04-10"}'
✓ created expense exp_7g8h9i
Expense recorded: Client lunch — Müller GmbH — €47.80 (meals)
```

Write responses look good — structured IDs, entity types, human-readable context. Let's check reads:

```bash
$ kitstack call kit expense list_expenses '{}'
| Date | Description | Amount | Category |
|------|-------------|--------|----------|
| 2026-04-15 | Flight Berlin → Frankfurt | 189.50 | travel |
| 2026-04-10 | Client lunch — Müller GmbH | 47.80 | meals |
| 2026-04-01 | Adobe Creative Cloud | 65.49 | software |

3 expenses, total: €302.79
```

Good — sorted by date descending, shows totals. But amounts don't show the € symbol inline or use German formatting.

```bash
$ kitstack call kit expense quarterly_summary '{"year":2026,"quarter":2}'
## Q2 2026 Summary
Total expenses: €302.79
- travel: €189.50
- software: €65.49
- meals: €47.80
```

**Issue:** No VAT breakdown. For German freelancers, the quarterly summary must show net/VAT/gross split.

### Param Description Check

```bash
$ kitstack call kit expense add_expense
Parameters:
  description: string — What the expense is for
  amount: number — Gross amount in euros
  category: string — Expense category
  date: string (optional) — Date in YYYY-MM-DD format
```

Descriptions are present but `category` should be an enum to show valid values.

### Error Handling Check

```bash
$ kitstack call kit expense add_expense '{"description":"","amount":0}'
✓ created expense exp_bad1
Expense recorded:  — €0.00 ()
```

**Issue:** Empty description and zero amount accepted without validation. Should reject or warn.

```bash
$ kitstack call kit expense update_expense '{"expenseId":"nonexistent","category":"travel"}'
Error: Expense not found (nonexistent)
```

Good — not-found handling works.

### Round 1 Report

```markdown
## Tool Iterator Report: expense

### Summary
- **Actions discovered**: 7 total (4 write, 3 read)
- **Actions tested**: 6/7 (import_csv skipped — requires file)
- **Workflow chains tested**: 2
- **Issues found**: 4 (critical: 0, warning: 3, suggestion: 1)

### Write Response Audit

| Action | Returns ID? | Entity Type | Format Correct? | Chainable? |
|--------|------------|-------------|-----------------|------------|
| add_expense | yes | expense | ✓ | ✓ |
| categorize | yes | expense | ✓ (updated) | ✓ |
| update_expense | yes | expense | ✓ (updated) | ✓ |

All write tools pass ✓

### Param Description Audit

| Action | Params with .describe() | Params missing .describe() |
|--------|------------------------|----------------------------|
| add_expense | description, amount, date | — |
| categorize | — | expenseId |
| update_expense | — | expenseId, category |

### Issues

1. **[warning]** `quarterly_summary` doesn't show VAT breakdown. For German freelancers (the target audience), Netto/USt/Brutto split is essential for Steuerberater prep. **Fix:** Calculate and display: Netto (amount / 1.19), USt 19% (amount - netto), Brutto (amount). Group by VAT rate if multiple rates exist.

2. **[warning]** `category` on add_expense is a bare `string`. Should be `z.enum(["travel","software","office","meals","other"]).describe("Expense category")` so LLMs see valid values and don't invent categories.

3. **[warning]** `add_expense` accepts empty description and zero amount. Should validate: description non-empty, amount > 0. **Fix:** Add `.min(1, "Description required")` and `.positive("Amount must be positive")` to Zod schema.

4. **[suggestion]** `expenseId` on categorize and update_expense has no `.describe()`. **Fix:** `.describe("Expense ID from add_expense or list_expenses")`

### Verdict: Good foundation, 3 warnings to fix before deploy
```

## After Fixes

All 4 issues fixed. Key improvements:
- `quarterly_summary` now shows: Netto €254.45 | USt 19% €48.34 | Brutto €302.79
- `category` is now an enum with 5 values
- Validation rejects empty description and zero/negative amounts
- All ID params have `.describe()` annotations

Kit ready for deployment.
