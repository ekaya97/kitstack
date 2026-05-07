# Pricing Display Patterns

## Number Formatting by Locale

### German (de-DE)
- Thousands separator: `.` (dot)
- Decimal separator: `,` (comma)
- Currency position: after the number
- Examples:
  - `1.234,56 €`
  - `110,00 €`
  - `12.500,00 €`
  - `0,00 €` (for Kleinunternehmer VAT line)

### English US (en-US)
- Thousands separator: `,` (comma)
- Decimal separator: `.` (dot)
- Currency position: before the number
- Examples:
  - `$1,234.56`
  - `$110.00`
  - `$12,500.00`

### English UK (en-GB)
- Same format as US
- Examples:
  - `£1,234.56`
  - `£110.00`

### Swiss (de-CH)
- Thousands separator: `'` (apostrophe) or space
- Decimal separator: `.` (dot)
- Currency position: before the number
- Examples:
  - `CHF 1'234.56`
  - `CHF 110.00`

---

## Line Items Table Layout

### Standard Columns
```
| Description          | Qty |  Unit Price |     Amount |
|----------------------|----:|------------:|-----------:|
| UX Design — App      |  40 |   110,00 €  | 4.400,00 € |
| Workshop Preparation |   1 |   950,00 €  |   950,00 € |
```

### Rules
1. **Description** — left-aligned, widest column (~50% of table width)
2. **Quantity** — right-aligned, narrow column
3. **Unit Price** — right-aligned, use tabular-nums for alignment
4. **Amount** — right-aligned, use tabular-nums, this is quantity × unit price
5. All amounts in the same column should align on the decimal point
6. Use `font-variant-numeric: tabular-nums` in CSS for proper alignment

### Optional Sub-lines
For detail or context beneath a line item:
```
| UX Design — App Redesign                              |  40 | 110,00 € | 4.400,00 € |
|   User research, wireframes, prototypes (April 2026)  |     |          |             |
```
Style sub-lines in a smaller font size and muted color.

---

## Totals Section Layout

### Standard (Single Tax Rate)
```
                          Zwischensumme    5.350,00 €
                          USt. 19%         1.016,50 €
                          ─────────────────────────────
                          Gesamtbetrag     6.366,50 €
```

### Multiple Tax Rates
```
                          Zwischensumme    5.350,00 €
                          USt. 19%           836,00 €
                          USt. 7%             28,00 €
                          ─────────────────────────────
                          Gesamtbetrag     6.214,00 €
```

### Kleinunternehmer (§19 UStG)
```
                          Zwischensumme    5.350,00 €
                          USt. 0%              0,00 €
                          ─────────────────────────────
                          Gesamtbetrag     5.350,00 €
```

### With Discount
```
                          Zwischensumme    5.350,00 €
                          Rabatt 10%        −535,00 €
                          Netto             4.815,00 €
                          USt. 19%           914,85 €
                          ─────────────────────────────
                          Gesamtbetrag     5.729,85 €
```

### Rules
1. Right-align the totals section (float right or flex-end)
2. The total row gets a top border (2px solid) and bold text
3. Tax rows use a smaller font size and muted color
4. The total is the most visually prominent number on the invoice
5. Always show at least: subtotal, tax, total — even if tax is 0%

---

## Currency Display Conventions

### When to show currency symbols
- **Every amount in the totals section** — always show the symbol
- **Column headers** — show currency in the header OR in each cell, not both
- **Line items** — show in each cell if the header doesn't include it

### When to show the full currency code
- Cross-border invoices (show ISO code: EUR, USD, GBP)
- When currency might be ambiguous (CAD vs AUD vs USD — all use $)

### Mixed amounts — avoid
- If you have pre-tax and post-tax amounts, always label which is which
- Never show an amount without making it clear whether it includes tax

---

## Visual Hierarchy

The invoice should be scannable. A recipient should find the total in under 2 seconds.

### Size hierarchy (approximate):
1. **Total amount** — largest number on the page (16-18px, bold)
2. **Invoice number** — prominent in header (14px)
3. **Line item amounts** — standard size (13px)
4. **Subtotal / tax** — slightly smaller or muted (12-13px)
5. **Labels and headers** — small caps, muted color (10-11px)

### Color hierarchy:
1. **Total amount** — ink color (full black/dark brown), bold
2. **Line item amounts** — ink color, normal weight
3. **Tax amounts** — muted color, normal weight
4. **Labels** — muted/faint color, uppercase, small

### Spacing:
- Generous space above the totals section (24-32px)
- Clear visual separation between line items table and totals
- The payment section should feel like its own block (background color or border)
