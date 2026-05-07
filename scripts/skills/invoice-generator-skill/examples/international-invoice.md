# Example: Cross-Border Invoice with Reverse Charge

## User Input

> Invoice for TechFlow B.V. in Amsterdam. I did 60 hours of backend development at €130/hr in April. They're an EU company, VAT NL123456789B01. I'm based in Berlin, USt-IdNr DE111222333. Reverse charge applies. IBAN DE45 1001 0010 0987 6543 21, BIC PBNKDEFF, Berliner Sparkasse. Net 30.

## Generated Invoice Data

```json
{
  "lang": "en",
  "currency": "EUR",
  "invoice_number": "INV-2026-012",
  "invoice_date": "2026-05-02",
  "service_date": "2026-04-30",
  "payment_days": 30,
  "tax_rate": 0,
  "sender": {
    "name": "Max Bauer",
    "address_line1": "Prenzlauer Allee 89",
    "address_line2": "10405 Berlin, Germany",
    "contact": "max@maxbauer.dev",
    "tax_id": "",
    "vat_id": "DE111222333"
  },
  "client": {
    "name": "TechFlow B.V.",
    "address_line1": "Herengracht 420",
    "address_line2": "1017 BZ Amsterdam, Netherlands",
    "vat_id": "NL123456789B01"
  },
  "items": [
    {
      "description": "Backend Development",
      "detail": "API design, database optimization, microservice architecture (April 2026)",
      "quantity": 60,
      "unit_price": 130.00
    }
  ],
  "bank": {
    "account_holder": "Max Bauer",
    "iban": "DE45 1001 0010 0987 6543 21",
    "bic": "PBNKDEFF",
    "bank_name": "Berliner Sparkasse"
  },
  "tax_entries": [
    { "rate": 0, "amount": 0 }
  ],
  "legal_notice": "Reverse Charge — VAT to be accounted for by the recipient pursuant to Art. 196 EU VAT Directive / §13b UStG. Steuerschuldnerschaft des Leistungsempfängers.",
  "notes": "Supplier VAT ID: DE111222333 · Client VAT ID: NL123456789B01"
}
```

## Generated Invoice Output

The HTML artifact includes:

- **Header:** Max Bauer, Berlin — Invoice INV-2026-012
- **Addresses:** TechFlow B.V. (Amsterdam) and Max Bauer (Berlin)
- **Single line item:**
  - Backend Development — 60 hrs × €130.00 = €7,800.00
  - Detail: API design, database optimization, microservice architecture
- **Totals:**
  - Subtotal: €7,800.00
  - VAT 0%: €0.00
  - **Total: €7,800.00**
- **Legal notice (prominent):** "Reverse Charge — VAT to be accounted for by the recipient pursuant to Art. 196 EU VAT Directive / §13b UStG."
- **Both VAT IDs displayed:** DE111222333 (sender) and NL123456789B01 (client)
- **Payment:** Berliner Sparkasse IBAN/BIC, Net 30

## Key Points for This Scenario

### Why Reverse Charge?
When a German business provides services to another EU business:
- The supplier charges 0% VAT
- The recipient accounts for VAT in their own country (Netherlands in this case)
- Both VAT IDs must appear on the invoice
- The reverse charge notice is legally mandatory

### What Must Be Different
Compared to a domestic invoice:
1. **Tax rate: 0%** — no German VAT charged
2. **Reverse charge notice** — mandatory, in the language understood by the recipient
3. **Both VAT IDs** — supplier's USt-IdNr AND client's BTW-nummer
4. **No Steuernummer** — only USt-IdNr is relevant for EU cross-border
5. **Language** — typically English for cross-border invoices

### Reporting Obligation
This transaction must be reported in the German Zusammenfassende Meldung (EC Sales List) filed monthly or quarterly with the Bundeszentralamt für Steuern (BZSt). The report includes:
- Client's VAT ID
- Total net amount of services
- Reporting period
