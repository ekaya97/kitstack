# Invoice Data Structure

This is the JSON schema used by the `scripts/invoice-builder.py` script to generate invoices.

## Full Schema

```json
{
  "lang": "de | en",
  "currency": "EUR | USD | GBP | CHF",
  "invoice_number": "RE-2026-001",
  "invoice_date": "YYYY-MM-DD",
  "service_date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD (optional, calculated from payment_days)",
  "payment_days": 30,
  "tax_rate": 19,
  "kleinunternehmer": false,

  "sender": {
    "name": "Your Name or Company",
    "address_line1": "Street and Number",
    "address_line2": "ZIP City",
    "contact": "email@example.de · +49 123 456789",
    "tax_id": "27/456/12345",
    "vat_id": "DE123456789"
  },

  "client": {
    "name": "Client Name or Company",
    "address_line1": "Street and Number",
    "address_line2": "ZIP City, Country",
    "vat_id": "NL123456789B01 (for EU reverse charge)"
  },

  "items": [
    {
      "description": "Main line item title",
      "detail": "Optional sub-line with additional context",
      "quantity": 40,
      "unit_price": 110.00
    }
  ],

  "tax_entries": [
    { "rate": 19, "amount": 1016.50 }
  ],

  "bank": {
    "account_holder": "Account Name",
    "iban": "DE89 3704 0044 0532 0130 00",
    "bic": "COBADEFFXXX",
    "bank_name": "Commerzbank",
    "account_number": "123456789 (US/UK)",
    "routing_number": "021000021 (US)"
  },

  "payment_terms": "Custom payment terms text (overrides default)",
  "notes": "Additional notes, project reference, PO number",
  "legal_notice": "Custom legal notice (e.g., reverse charge)",
  "thank_you": "Custom thank-you message (overrides default)"
}
```

## Required vs Optional

### Always Required
- `sender.name` — Who is sending the invoice
- `client.name` — Who is receiving the invoice
- `items[]` — At least one line item with description and unit_price

### Has Smart Defaults
- `lang` — Defaults to `"de"`
- `currency` — Defaults to `"EUR"`
- `invoice_date` — Defaults to today
- `service_date` — Defaults to invoice_date
- `payment_days` — Defaults to 30
- `tax_rate` — Defaults to 19 (for Germany)
- `due_date` — Calculated from invoice_date + payment_days
- `items[].quantity` — Defaults to 1

### Optional Enhancements
- `sender.address_line1/2` — Strongly recommended for compliance
- `sender.tax_id` / `sender.vat_id` — Required for German invoices (§14 UStG)
- `client.address_line1/2` — Recommended for professional appearance
- `items[].detail` — Sub-line for additional context
- `bank` — Payment details block
- `tax_entries` — For multiple tax rates (overrides `tax_rate`)
- `kleinunternehmer` — Set to `true` for §19 UStG invoices
- `notes` — Additional notes section
- `legal_notice` — Custom legal text (auto-generated for Kleinunternehmer and reverse charge)
- `payment_terms` — Custom terms text
- `thank_you` — Custom closing message

## Line Item Examples

### Hourly Billing
```json
{
  "description": "UX Design — App Redesign",
  "detail": "User research, wireframes, prototypes (April 2026)",
  "quantity": 40,
  "unit_price": 110.00
}
```

### Fixed Project Fee
```json
{
  "description": "Phase 1: Discovery & Audit",
  "detail": "Stakeholder interviews, competitive analysis, findings report",
  "quantity": 1,
  "unit_price": 4500.00
}
```

### Product / License
```json
{
  "description": "Annual Software License — Pro Plan",
  "detail": "License period: May 2026 – April 2027",
  "quantity": 5,
  "unit_price": 299.00
}
```

### Travel / Expenses
```json
{
  "description": "Travel Expenses — Client Visit Frankfurt",
  "detail": "Train Berlin–Frankfurt return, hotel 1 night",
  "quantity": 1,
  "unit_price": 385.50
}
```
