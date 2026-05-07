# Example: EU Cross-Border E-Invoice with Reverse Charge

## User Input

> I'm a German freelancer and I need to create an XRechnung-style e-invoice for a Dutch company. They want structured electronic invoicing. 80 hours of software development at €120/hr in April. Reverse charge applies. My USt-IdNr: DE111222333, their BTW-nummer: NL987654321B01.

## Key Decision: XRechnung or Peppol BIS?

For EU cross-border B2B invoicing:
- **XRechnung** is a German standard — the Dutch recipient may not have tooling to process it
- **Peppol BIS Billing 3.0** is the EU-wide standard — better interoperability
- Both are based on EN 16931, so the XML structure is very similar
- **Recommendation:** Use UBL 2.1 with EN 16931 profile (Peppol BIS). The XRechnung generator can produce this with minor adjustments.

## Invoice Data

```json
{
  "invoice_number": "INV-2026-023",
  "invoice_date": "2026-05-05",
  "due_date": "2026-06-04",
  "service_period_start": "2026-04-01",
  "service_period_end": "2026-04-30",
  "currency": "EUR",
  "buyer_reference": "TF-PO-2026-089",
  "payment_terms": "Payment due within 30 days of invoice date.",
  "note": "Reverse Charge — VAT to be accounted for by the recipient. Art. 196 EU VAT Directive / §13b UStG.",
  "seller": {
    "name": "Max Bauer",
    "street": "Prenzlauer Allee 89",
    "city": "Berlin",
    "postal_code": "10405",
    "country_code": "DE",
    "vat_id": "DE111222333",
    "email": "max@maxbauer.dev",
    "endpoint_id": "DE111222333",
    "endpoint_scheme": "9930"
  },
  "buyer": {
    "name": "TechFlow B.V.",
    "street": "Herengracht 420",
    "city": "Amsterdam",
    "postal_code": "1017 BZ",
    "country_code": "NL",
    "vat_id": "NL987654321B01",
    "endpoint_id": "NL987654321B01",
    "endpoint_scheme": "9944"
  },
  "items": [
    {
      "description": "Software Development — Backend API and microservices architecture",
      "name": "Software Development",
      "quantity": 80,
      "unit_price": 120.00,
      "unit_code": "HUR",
      "tax_rate": 0,
      "tax_category": "AE"
    }
  ],
  "payment": {
    "means_code": "30",
    "iban": "DE45100100100987654321",
    "bic": "PBNKDEFF"
  }
}
```

## Reverse Charge Specifics

### What Changes in the XML

1. **Tax category code:** `AE` (instead of `S`) — "Reverse charge"
2. **Tax rate:** `0.00` — no VAT charged
3. **Tax amount:** `0.00 EUR`
4. **Both VAT IDs present:**
   - Seller: `DE111222333` in BT-31
   - Buyer: `NL987654321B01` in buyer tax scheme
5. **Mandatory note (BT-22):** "Reverse Charge — VAT to be accounted for by the recipient pursuant to Art. 196 EU VAT Directive / §13b UStG"
6. **Tax exemption reason (BT-120):** "VATEX-EU-AE" or "Reverse charge"

### XML Tax Section (different from domestic)

```xml
<cac:TaxTotal>
  <cbc:TaxAmount currencyID="EUR">0.00</cbc:TaxAmount>
  <cac:TaxSubtotal>
    <cbc:TaxableAmount currencyID="EUR">9600.00</cbc:TaxableAmount>
    <cbc:TaxAmount currencyID="EUR">0.00</cbc:TaxAmount>
    <cac:TaxCategory>
      <cbc:ID>AE</cbc:ID>
      <cbc:Percent>0.00</cbc:Percent>
      <cbc:TaxExemptionReasonCode>VATEX-EU-AE</cbc:TaxExemptionReasonCode>
      <cbc:TaxExemptionReason>Reverse charge - VAT to be accounted for by the recipient</cbc:TaxExemptionReason>
      <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
    </cac:TaxCategory>
  </cac:TaxSubtotal>
</cac:TaxTotal>
```

## Totals

- Subtotal: €9,600.00
- VAT (Reverse Charge): €0.00
- **Total: €9,600.00**

## Reporting Obligations

As the German seller, you must:

1. **Zusammenfassende Meldung (EC Sales List):**
   - Report this transaction to the BZSt
   - Due monthly or quarterly depending on your volume
   - Include: client's VAT ID, net amount, service type
   - File via Elster or BZSt portal

2. **Umsatzsteuer-Voranmeldung:**
   - Report in Kennzahl 21 (steuerfrei mit Vorsteuerabzug, innergemeinschaftliche Leistungen)
   - Net amount goes here

3. **Verification:**
   - Before invoicing, verify the client's VAT ID via the EU VIES system
   - BZSt offers a qualified confirmation (qualifizierte Bestätigung) — recommended for large invoices
