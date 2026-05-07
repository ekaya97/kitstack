# Example: Agency Multi-Phase Project Invoice

## User Input

> Create an invoice for our brand strategy project with Greenfield Ventures. Three phases: Discovery (€4,500), Strategy (€6,500), and Implementation (€3,800). We're Studio Kreativ GmbH, Linienstraße 78, 10115 Berlin. Tax ID 30/234/56789, VAT DE987654321. Bank: Deutsche Bank, IBAN DE23 1007 0024 0123 4567 89, BIC DEUTDEDBBER. Net 30.

## Generated Invoice Data

```json
{
  "lang": "en",
  "currency": "EUR",
  "invoice_number": "SK-2026-017",
  "invoice_date": "2026-05-07",
  "service_date": "2026-04-30",
  "payment_days": 30,
  "tax_rate": 19,
  "sender": {
    "name": "Studio Kreativ GmbH",
    "address_line1": "Linienstraße 78",
    "address_line2": "10115 Berlin",
    "contact": "hello@studiokreativ.de",
    "tax_id": "30/234/56789",
    "vat_id": "DE987654321"
  },
  "client": {
    "name": "Greenfield Ventures Ltd",
    "address_line1": "48 Charlotte Street",
    "address_line2": "London W1T 2NS, United Kingdom"
  },
  "items": [
    {
      "description": "Phase 1: Discovery & Audit",
      "detail": "Stakeholder interviews, market research, competitive audit, findings presentation",
      "quantity": 1,
      "unit_price": 4500.00
    },
    {
      "description": "Phase 2: Brand Strategy",
      "detail": "Positioning framework, messaging architecture, value proposition, brand narrative",
      "quantity": 1,
      "unit_price": 6500.00
    },
    {
      "description": "Phase 3: Implementation",
      "detail": "Visual identity system, brand guidelines document, asset library, launch support",
      "quantity": 1,
      "unit_price": 3800.00
    }
  ],
  "bank": {
    "account_holder": "Studio Kreativ GmbH",
    "iban": "DE23 1007 0024 0123 4567 89",
    "bic": "DEUTDEDBBER",
    "bank_name": "Deutsche Bank"
  },
  "notes": "Project ref: GV-BRAND-2026. Phase deliverables per signed SOW dated March 12, 2026."
}
```

## Generated Invoice Output

The HTML artifact renders a professional invoice with:

- **Header:** Studio Kreativ GmbH logo area, invoice number SK-2026-017
- **Addresses:** Bill To (Greenfield Ventures, London) and From (Studio Kreativ, Berlin)
- **Three phased line items** with detail sub-lines explaining each deliverable
- **Totals:**
  - Subtotal: €14,800.00
  - VAT 19%: €2,812.00
  - **Total: €17,612.00**
- **Payment section:** Deutsche Bank IBAN/BIC details, "Payment due within 30 days of invoice date"
- **Footer:** Tax ID and VAT ID, project reference note

## Notes for This Example

- English language used because the client is UK-based
- Standard 19% German VAT applies (DE→UK B2B should actually use reverse charge post-Brexit, but this example shows the standard flow — see the international example for reverse charge)
- Phased items use quantity 1 with fixed project fees rather than hourly billing
- Project reference included in the notes section for the client's accounting
