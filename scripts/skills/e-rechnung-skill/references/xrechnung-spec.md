# XRechnung Specification Overview

## What Is XRechnung?

XRechnung is the German national standard for electronic invoicing, implementing the European Norm EN 16931. It defines a structured XML format that enables automated processing of invoices by public authorities and businesses.

**Current version:** XRechnung 3.0 (based on EN 16931:2017)
**XML format:** UBL 2.1 (primary) or UN/CEFACT CII (alternative)
**Maintained by:** KoSIT (Koordinierungsstelle für IT-Standards)

## Mandatory Business Terms (BT Codes)

Every XRechnung must contain these fields. Missing any causes rejection.

### Document Level

| BT Code | Field | XML Path (UBL) | Example |
|---------|-------|-----------------|---------|
| BT-1 | Invoice number | cbc:ID | RE-2026-042 |
| BT-2 | Issue date | cbc:IssueDate | 2026-05-07 |
| BT-3 | Invoice type code | cbc:InvoiceTypeCode | 380 |
| BT-5 | Currency code | cbc:DocumentCurrencyCode | EUR |
| BT-9 | Due date | cbc:DueDate | 2026-05-21 |
| BT-10 | Buyer reference | cbc:BuyerReference | 0204:991-12345-67 |
| BT-20 | Payment terms | PaymentTerms/cbc:Note | Net 14 Tage |
| BT-22 | Notes | cbc:Note | (optional) |
| BT-24 | Specification ID | cbc:CustomizationID | urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0 |

### Invoice Type Codes (BT-3)

| Code | Meaning |
|------|---------|
| 380 | Commercial invoice (Rechnung) |
| 381 | Credit note (Gutschrift) |
| 384 | Corrected invoice (Korrekturrechnung) |
| 389 | Self-billed invoice |

### Seller (BG-4)

| BT Code | Field | Required |
|---------|-------|----------|
| BT-27 | Seller name | Yes |
| BT-31 | Seller VAT ID (USt-IdNr) | Yes (or BT-32) |
| BT-32 | Seller tax registration (Steuernummer) | Yes (or BT-31) |
| BT-34 | Seller electronic address | Yes |
| BT-35 | Seller street | Yes |
| BT-37 | Seller city | Yes |
| BT-38 | Seller postal code | Yes |
| BT-40 | Seller country code | Yes |

### Buyer (BG-7)

| BT Code | Field | Required |
|---------|-------|----------|
| BT-44 | Buyer name | Yes |
| BT-49 | Buyer electronic address | Yes (for routing) |
| BT-50 | Buyer street | Yes |
| BT-52 | Buyer city | Yes |
| BT-53 | Buyer postal code | Yes |
| BT-55 | Buyer country code | Yes |

### Payment (BG-16)

| BT Code | Field | Required |
|---------|-------|----------|
| BT-81 | Payment means code | Yes |
| BT-84 | Payment account (IBAN) | Yes (for credit transfer) |
| BT-86 | Payment service provider (BIC) | Recommended |

**Payment means codes:**
| Code | Meaning |
|------|---------|
| 30 | Credit transfer (Überweisung) — most common |
| 58 | SEPA credit transfer |
| 59 | SEPA direct debit |

### Tax (BG-23)

| BT Code | Field | Required |
|---------|-------|----------|
| BT-110 | Tax amount | Yes |
| BT-116 | Tax category taxable amount | Yes (per rate) |
| BT-117 | Tax category tax amount | Yes (per rate) |
| BT-118 | Tax category code | Yes |
| BT-119 | Tax category rate | Yes |

**Tax category codes:**
| Code | Meaning |
|------|---------|
| S | Standard rate (19% or 7%) |
| Z | Zero-rated |
| E | Exempt |
| AE | Reverse charge |
| K | Intra-community supply |
| O | Not subject to VAT |

### Monetary Totals (BG-22)

| BT Code | Field | Required |
|---------|-------|----------|
| BT-106 | Sum of line net amounts | Yes |
| BT-109 | Tax exclusive amount | Yes |
| BT-112 | Tax inclusive amount | Yes |
| BT-115 | Amount due for payment | Yes |

### Line Items (BG-25)

| BT Code | Field | Required |
|---------|-------|----------|
| BT-126 | Line ID | Yes |
| BT-129 | Invoiced quantity | Yes |
| BT-130 | Unit of measure | Yes |
| BT-131 | Line net amount | Yes |
| BT-153 | Item name | Yes |
| BT-146 | Item net price | Yes |

**Common unit codes (UN/ECE Recommendation 20):**
| Code | Meaning |
|------|---------|
| HUR | Hour (Stunde) |
| DAY | Day (Tag) |
| MON | Month (Monat) |
| C62 | Unit/piece (Stück) |
| KGM | Kilogram |
| LTR | Litre |
| MTR | Metre |

## XML Structure (UBL 2.1)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<ubl:Invoice xmlns:ubl="..." xmlns:cac="..." xmlns:cbc="...">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>RE-2026-042</cbc:ID>
  <cbc:IssueDate>2026-05-07</cbc:IssueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>0204:991-12345-67</cbc:BuyerReference>

  <cac:AccountingSupplierParty>...</cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>...</cac:AccountingCustomerParty>
  <cac:PaymentMeans>...</cac:PaymentMeans>
  <cac:TaxTotal>...</cac:TaxTotal>
  <cac:LegalMonetaryTotal>...</cac:LegalMonetaryTotal>
  <cac:InvoiceLine>...</cac:InvoiceLine>
</ubl:Invoice>
```

## Validation

XRechnung validation happens at three levels:
1. **XML Schema** — well-formed XML, correct namespace
2. **EN 16931 rules** — all mandatory BT fields present
3. **XRechnung rules** — German-specific requirements (BT-10 mandatory, Leitweg-ID format)

The official validator is maintained by KoSIT: https://github.com/itplr-kosit/validator
