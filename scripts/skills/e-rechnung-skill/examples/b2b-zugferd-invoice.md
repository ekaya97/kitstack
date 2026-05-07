# Example: B2B ZUGFeRD Invoice

## User Input

> I need to create a ZUGFeRD invoice for a B2B client. My company is Weber Digital GmbH, Frankfurt. The client is AutoParts Handel GmbH in Stuttgart. I did a website redesign for €12,000 (fixed price) in March-April 2026. Standard 19% VAT. What format should I use and how do I create it?

## Recommendation

For B2B invoicing, **ZUGFeRD EN16931** is the best choice:
- The client gets a readable PDF they can file and review
- The embedded XML enables automated processing in their accounting system
- It's future-proof (B2B e-invoicing becomes mandatory in 2027-2028)

## Invoice Data

```json
{
  "invoice_number": "WD-2026-018",
  "invoice_date": "2026-05-01",
  "due_date": "2026-05-31",
  "service_period_start": "2026-03-01",
  "service_period_end": "2026-04-30",
  "currency": "EUR",
  "buyer_reference": "AP-PO-2026-042",
  "payment_terms": "Zahlbar innerhalb von 30 Tagen nach Rechnungserhalt. 2% Skonto bei Zahlung innerhalb von 7 Tagen.",
  "seller": {
    "name": "Weber Digital GmbH",
    "street": "Mainzer Landstraße 55",
    "city": "Frankfurt am Main",
    "postal_code": "60329",
    "country_code": "DE",
    "vat_id": "DE234567890",
    "tax_id": "45/678/90123",
    "email": "rechnung@weberdigital.de",
    "contact_name": "Thomas Weber",
    "phone": "+49 69 98765432"
  },
  "buyer": {
    "name": "AutoParts Handel GmbH",
    "street": "Industriestraße 88",
    "city": "Stuttgart",
    "postal_code": "70174",
    "country_code": "DE",
    "vat_id": "DE345678901"
  },
  "items": [
    {
      "description": "Website Redesign — Konzeption & UX Design",
      "name": "Konzeption",
      "quantity": 1,
      "unit_price": 4500.00,
      "unit_code": "C62",
      "tax_rate": 19
    },
    {
      "description": "Website Redesign — Frontend-Entwicklung",
      "name": "Entwicklung",
      "quantity": 1,
      "unit_price": 5500.00,
      "unit_code": "C62",
      "tax_rate": 19
    },
    {
      "description": "Website Redesign — CMS-Integration & Launch",
      "name": "Integration",
      "quantity": 1,
      "unit_price": 2000.00,
      "unit_code": "C62",
      "tax_rate": 19
    }
  ],
  "payment": {
    "means_code": "58",
    "iban": "DE56 5001 0517 1234 5678 90",
    "bic": "INGDDEFFXXX"
  }
}
```

## Totals

- Subtotal: €12,000.00
- USt. 19%: €2,280.00
- **Total: €14,280.00**

## How to Create the ZUGFeRD File

### Step 1: Generate the CII XML
The XRechnung generator can be adapted for CII format, or use the generated UBL XML as the data source. For ZUGFeRD, the embedded XML uses UN/CEFACT CII format.

### Step 2: Create the PDF
Design a professional invoice PDF (using the invoice-template.html from the Invoice Generator skill, exported to PDF) or use your accounting software.

### Step 3: Embed XML into PDF
Using the Python `factur-x` library:
```python
from facturx import generate_from_file

generate_from_file(
    pdf_invoice="invoice-WD-2026-018.pdf",
    xml=open("factur-x.xml", "rb").read(),
    output_pdf_file="invoice-WD-2026-018-zugferd.pdf",
    flavor="factur-x",
    level="en16931"
)
```

### Step 4: Send
Email the ZUGFeRD PDF to the client. They see a normal PDF invoice, and their accounting system can automatically extract the structured data.

## Key Differences from XRechnung

| Aspect | This B2B ZUGFeRD | B2G XRechnung |
|--------|-------------------|---------------|
| Format | PDF + embedded XML | Pure XML |
| Leitweg-ID | Not needed (B2B) | Required (BT-10) |
| Buyer reference | PO number | Leitweg-ID |
| Delivery | Email attachment | ZRE portal or Peppol |
| Human-readable | Yes (PDF) | No (needs viewer) |
