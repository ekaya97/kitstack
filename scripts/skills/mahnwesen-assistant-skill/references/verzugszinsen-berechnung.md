# Verzugszinsen Calculation — §288 BGB

This reference explains how to calculate default interest (Verzugszinsen) on overdue invoices under German law.

## The Legal Basis: §288 BGB

### §288 Abs. 1 BGB — Consumer debts (B2C)
> Default interest on monetary claims is 5 percentage points above the Basiszinssatz per year.

### §288 Abs. 2 BGB — Business debts (B2B)
> For transactions where no consumer is involved, the interest rate is 9 percentage points above the Basiszinssatz per year.

### §288 Abs. 5 BGB — Mahnpauschale (B2B only)
> The creditor of a monetary claim can demand a flat fee of 40 EUR for recovery costs. This is in addition to Verzugszinsen.

## Current Basiszinssatz

| Period | Basiszinssatz |
|--------|--------------|
| 01.01.2026 - 30.06.2026 | 2.27% |

The Basiszinssatz is published by the Deutsche Bundesbank on January 1 and July 1 each year.

**Where to check for updates:** https://www.bundesbank.de/basiszinssatz

## Resulting Interest Rates

| Debtor Type | Formula | Current Rate |
|------------|---------|-------------|
| B2C (Verbraucher) | Basiszinssatz + 5% | 2.27% + 5% = **7.27% p.a.** |
| B2B (Unternehmer) | Basiszinssatz + 9% | 2.27% + 9% = **11.27% p.a.** |

## Calculation Method

### Daily Interest Calculation

Verzugszinsen are calculated on a daily basis:

```
Daily interest = (Outstanding amount x Annual interest rate) / 365
Total interest = Daily interest x Number of days in Verzug
```

### Step-by-Step Process

1. **Determine the start of Verzug** (see `references/bgb-286-verzug.md`)
2. **Determine the debtor type** (B2B or B2C)
3. **Look up the current Basiszinssatz** for the relevant period
4. **Calculate the annual rate:** Basiszinssatz + 5% (B2C) or + 9% (B2B)
5. **Calculate daily interest:** (Amount x Annual rate) / 365
6. **Multiply by days in Verzug**
7. **Add Mahnpauschale** if B2B (40 EUR)

### Important: Period-Spanning Calculation

If the Verzug period spans a Basiszinssatz change (crosses January 1 or July 1), you must split the calculation into two periods, each with the applicable Basiszinssatz.

**Example:** Verzug from December 1, 2025 to February 15, 2026
- Period 1: Dec 1 - Dec 31 (31 days) at the H2/2025 Basiszinssatz
- Period 2: Jan 1 - Feb 15 (46 days) at the H1/2026 Basiszinssatz (2.27%)

## Worked Examples

### Example 1: B2B — Simple Case

**Situation:**
- Invoice amount: 5,000.00 EUR
- Due date: 01.02.2026
- Payment date: 15.03.2026 (42 days overdue)
- Debtor: GmbH (B2B)

**Calculation:**
```
Annual rate = 2.27% + 9% = 11.27%
Daily interest = 5,000.00 x 0.1127 / 365 = 1.5438 EUR/day
Days in Verzug = 42
Verzugszinsen = 1.5438 x 42 = 64.84 EUR
Mahnpauschale (B2B) = 40.00 EUR

Total claim:
  Original amount:     5,000.00 EUR
  Verzugszinsen:          64.84 EUR
  Mahnpauschale:          40.00 EUR
  ─────────────────────────────────
  Total:               5,104.84 EUR
```

### Example 2: B2C — Private Client

**Situation:**
- Invoice amount: 1,200.00 EUR
- Due date: 15.01.2026
- Payment date: 28.02.2026 (44 days overdue)
- Debtor: Private person (B2C)

**Calculation:**
```
Annual rate = 2.27% + 5% = 7.27%
Daily interest = 1,200.00 x 0.0727 / 365 = 0.2390 EUR/day
Days in Verzug = 44
Verzugszinsen = 0.2390 x 44 = 10.52 EUR
Mahnpauschale: NOT applicable (B2C)

Total claim:
  Original amount:     1,200.00 EUR
  Verzugszinsen:          10.52 EUR
  ─────────────────────────────────
  Total:               1,210.52 EUR
```

### Example 3: Large B2B Invoice — Long Overdue

**Situation:**
- Invoice amount: 25,000.00 EUR
- Due date: 01.11.2025
- Payment date: still unpaid as of 01.03.2026 (121 days overdue)
- Debtor: AG (B2B)

**Calculation (simplified, assuming same Basiszinssatz for full period):**
```
Annual rate = 2.27% + 9% = 11.27%
Daily interest = 25,000.00 x 0.1127 / 365 = 7.7192 EUR/day
Days in Verzug = 121
Verzugszinsen = 7.7192 x 121 = 934.02 EUR
Mahnpauschale (B2B) = 40.00 EUR

Total claim:
  Original amount:    25,000.00 EUR
  Verzugszinsen:         934.02 EUR
  Mahnpauschale:          40.00 EUR
  ─────────────────────────────────
  Total:              25,974.02 EUR
```

Note: If the period spans a Basiszinssatz change (e.g., from H2/2025 to H1/2026), split the calculation at the changeover date.

## The Mahnpauschale (§288 Abs. 5 BGB)

- **Amount:** 40.00 EUR (fixed)
- **Applies to:** B2B claims only (Entgeltforderungen aus Rechtsgeschaeften, an denen kein Verbraucher beteiligt ist)
- **When:** Once per claim, as soon as Verzug begins
- **Cumulative:** If you have 3 unpaid invoices, you can claim 3 x 40 EUR
- **Offset:** The Mahnpauschale is offset against other recovery costs (e.g., lawyer fees). It is not additional on top of lawyer fees.

## CLI Script

Use `scripts/verzugszinsen-rechner.py` for automated calculation:

```bash
# Simple calculation
python scripts/verzugszinsen-rechner.py --amount 3500 --due-date 2026-03-15 --debtor-type business

# With specific payment date
python scripts/verzugszinsen-rechner.py --amount 3500 --due-date 2026-03-15 --payment-date 2026-05-01 --debtor-type consumer

# Show example
python scripts/verzugszinsen-rechner.py --example

# JSON input via stdin
echo '{"amount": 3500, "due_date": "2026-03-15", "debtor_type": "business"}' | python scripts/verzugszinsen-rechner.py --stdin
```

## Common Mistakes

1. **Using the wrong Basiszinssatz** — it changes twice a year. Always verify.
2. **Forgetting to split periods** when Verzug spans a Basiszinssatz change.
3. **Claiming Mahnpauschale for B2C** — it only applies to B2B.
4. **Calculating interest before Verzug began** — interest only accrues from the start of Verzug, not from the invoice date.
5. **Rounding errors** — calculate to full precision, round only the final result to 2 decimal places.
