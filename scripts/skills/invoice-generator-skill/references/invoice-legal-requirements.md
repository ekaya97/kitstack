# Invoice Legal Requirements by Jurisdiction

## Germany (§14 UStG)

German invoices must contain all of the following. Missing any field can result in the recipient being unable to deduct VAT (Vorsteuerabzug).

### Mandatory Fields

| # | Field | German Term | Notes |
|---|-------|-------------|-------|
| 1 | Sender full name & address | Rechnungssteller | Legal name, not just a brand |
| 2 | Recipient full name & address | Rechnungsempfänger | Must match the legal entity |
| 3 | Tax number OR VAT ID | Steuernummer / USt-IdNr | At least one is required |
| 4 | Invoice date | Rechnungsdatum | The date of issue |
| 5 | Unique sequential invoice number | Rechnungsnummer | Must be part of a continuous, traceable sequence |
| 6 | Description of service/goods | Art und Umfang der Leistung | Specific enough to identify what was provided |
| 7 | Service delivery date | Leistungszeitpunkt / Lieferdatum | Mandatory even if same as invoice date — use "Leistungsdatum entspricht Rechnungsdatum" |
| 8 | Net amount per item | Entgelt (netto) | Before tax |
| 9 | Tax rate per item | Steuersatz | 19% standard, 7% reduced, 0% exempt |
| 10 | Tax amount | Steuerbetrag | Calculated from net × rate |
| 11 | Gross total | Bruttobetrag | Net + tax |

### Kleinunternehmer (§19 UStG)

If you are registered as a Kleinunternehmer (small business, revenue < €22,000/year):

- Show **0% VAT** — do not include a tax amount
- **Mandatory notice on the invoice:** "Gemäß §19 UStG wird keine Umsatzsteuer berechnet."
- All other fields from the table above still apply
- You still need a Steuernummer (not a USt-IdNr, since you don't charge VAT)

### Reverse Charge (§13b UStG)

When invoicing another EU business (innergemeinschaftliche Leistung):

- Show **0% VAT** with the note: "Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge, §13b UStG)"
- Include **both** your USt-IdNr and the client's USt-IdNr
- The client handles VAT in their own country

### Kleinbetragsrechnung (§33 UStDV)

For invoices ≤ €250 gross, simplified rules apply:

- Sender name and address
- Invoice date
- Description of goods/services
- Gross amount and tax rate
- No recipient name required
- No separate net/tax split required
- No invoice number required

---

## United States

The US has no federal invoice format law, but best practices and state sales tax requirements apply.

### Standard Fields

| Field | Notes |
|-------|-------|
| Business name & address | Legal entity name |
| Client name & address | "Bill To" |
| Invoice number | Sequential for record-keeping |
| Invoice date | Date of issue |
| Due date | When payment is expected |
| Itemized services/goods | Description, quantity, rate, amount |
| Subtotal | Before tax |
| Sales tax (if applicable) | Varies by state; services often exempt |
| Total due | Grand total |
| Payment terms | Net 30, Net 60, etc. |
| EIN / Tax ID | Optional but professional |

### Sales Tax Notes

- Not all states charge sales tax on services (most don't)
- Physical goods are usually taxable
- Some states have no sales tax: OR, MT, NH, DE, AK
- SaaS is increasingly taxable in many states
- If you're a freelancer selling services, you typically don't charge sales tax

---

## United Kingdom

UK invoices must comply with HMRC VAT invoice rules if you're VAT-registered.

### VAT Invoice Required Fields

| Field | Notes |
|-------|-------|
| Supplier name, address, VAT number | Your business details |
| Customer name & address | Their legal entity |
| Unique sequential invoice number | Continuous numbering |
| Invoice date | Date of issue |
| Tax point (supply date) | When the goods/services were supplied |
| Description of goods/services | Specific enough to identify |
| Quantity & unit price | Per item |
| Rate of VAT per item | 20% standard, 5% reduced, 0% zero-rated |
| Total excluding VAT | Net total |
| Total VAT | Tax amount |
| Total including VAT | Gross total |

### Simplified VAT Invoice (under £250)

- Your name, address, VAT number
- Date
- Description of goods/services
- Total including VAT
- VAT rate

### Non-VAT-Registered

If not VAT-registered (below £90,000 threshold):
- Do not show VAT or a VAT number
- Show totals as final amounts
- Include a note: "Not VAT registered" (optional but clear)

---

## Cross-Border Invoicing (EU)

### EU B2B (Reverse Charge)

- Include both VAT IDs (yours and client's)
- Charge 0% VAT
- Add: "Reverse charge — VAT to be accounted for by the recipient"
- Report in your EC Sales List (Zusammenfassende Meldung in DE)

### EU B2C (Consumer)

- Charge your country's VAT rate (or the destination country's rate for digital services under OSS)
- Include all standard domestic fields

### Non-EU

- No EU VAT applies
- Mark as "Export / Third country — tax-free under §4 Nr. 1a UStG" (Germany) or equivalent
- Include your tax ID for the client's records

---

## Common Mistakes That Cause Compliance Issues

1. **Missing Leistungszeitpunkt** — The most common German invoice error. Always include the service delivery date.
2. **Using "Rechnung" as invoice number** — The number must be unique and sequential, not just the word "Rechnung."
3. **Steuernummer vs. USt-IdNr confusion** — Steuernummer is your local tax office number. USt-IdNr is for EU cross-border.
4. **Forgetting Kleinunternehmer notice** — If you don't charge VAT, you must explain why on the invoice.
5. **Vague service descriptions** — "Beratung" alone is insufficient. Specify what kind of consulting, for what period.
6. **Mixed currencies without explanation** — If line items are in different currencies, clarify the exchange rate and total currency.
7. **Missing reverse charge notice** — Without the notice, the client may not claim the VAT deduction.
