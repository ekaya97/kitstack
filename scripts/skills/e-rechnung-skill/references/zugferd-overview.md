# ZUGFeRD Overview

## What Is ZUGFeRD?

ZUGFeRD (Zentraler User Guide des Forums elektronische Rechnung Deutschland) is a German standard for electronic invoicing that embeds structured XML data inside a PDF/A-3 document. This means the invoice is both human-readable (PDF) and machine-readable (XML).

**Current version:** ZUGFeRD 2.1.1 (aligned with EN 16931 / Factur-X)
**Maintained by:** Forum elektronische Rechnung Deutschland (FeRD)

## ZUGFeRD vs XRechnung

| Feature | ZUGFeRD | XRechnung |
|---------|---------|-----------|
| **Format** | PDF/A-3 + embedded XML | Pure XML (UBL 2.1 or CII) |
| **Human-readable** | Yes (it's a PDF) | No (XML only) |
| **Machine-readable** | Yes (embedded XML) | Yes |
| **B2G accepted** | Yes (EN16931 profile) | Yes (primary format) |
| **B2B common** | Very common | Growing |
| **Creation complexity** | Higher (PDF + XML) | Lower (XML only) |
| **File size** | Larger (PDF + XML) | Small (XML only) |
| **Archiving** | PDF/A-3 compliant | Requires separate rendering |

### When to Use Which

**Use XRechnung when:**
- Invoicing a German federal authority (Bundesbehörde) — it's the primary standard
- The recipient's portal only accepts XML
- You want the simplest possible format
- Submitting via Peppol network

**Use ZUGFeRD when:**
- The recipient is a business that prefers PDF invoices
- You want the invoice to be readable without special software
- The recipient uses both automated processing AND manual review
- Sending via email (PDF attachment is more familiar)
- You need to comply with B2G requirements AND want PDF readability

## ZUGFeRD Profiles

ZUGFeRD defines multiple conformance profiles, each with increasing data requirements:

### MINIMUM
- Absolute bare minimum of structured data
- Invoice number, date, seller/buyer names, total amount, VAT
- **Use case:** Archiving, basic automated booking
- **B2G accepted:** No

### BASIC
- Core invoice data in structured form
- Line items, tax breakdowns, payment information
- **Use case:** Standard B2B invoicing
- **B2G accepted:** No

### EN16931 (Comfort)
- Full EN 16931 compliance
- All mandatory fields per the European standard
- **Use case:** B2G invoicing, full compliance
- **B2G accepted:** Yes — this is the profile that authorities accept
- **Equivalent to:** XRechnung in terms of data content

### EXTENDED
- Superset of EN16931 with additional fields
- Supports complex scenarios: rebates, allowances, multiple deliveries
- **Use case:** Complex B2B transactions
- **B2G accepted:** No (but downward-compatible data is accepted)

### Profile Selection Guide

```
Do you invoice a German public authority?
  └─ Yes → EN16931 (or just use XRechnung XML)
  └─ No → Is the recipient a business?
       └─ Yes → BASIC (simple) or EN16931 (if they want full compliance)
       └─ No → MINIMUM (archiving) or regular PDF (no ZUGFeRD needed)
```

## Technical Structure

A ZUGFeRD invoice is a PDF/A-3 file with:
1. **The PDF document** — visual representation of the invoice
2. **An embedded XML file** — structured invoice data (CII format)
3. **Metadata** — linking the XML to the PDF via XMP

The embedded XML file is named `factur-x.xml` (Factur-X/ZUGFeRD 2.x) and follows the UN/CEFACT Cross Industry Invoice (CII) schema.

## Creating ZUGFeRD Invoices

### Options:
1. **Accounting software** — Most German accounting tools (Lexoffice, sevDesk, DATEV) export ZUGFeRD natively
2. **Libraries:**
   - Python: `factur-x` library (pip install factur-x)
   - Java: Mustang library
   - PHP: ZUGFeRD-PHP
3. **Manual:** Create a PDF/A-3, then embed the XML using a PDF library

### Python Example (factur-x library):
```python
from facturx import generate_from_file

# Generate ZUGFeRD PDF from existing PDF + XML
generate_from_file(
    pdf_invoice="invoice.pdf",
    xml=open("factur-x.xml", "rb").read(),
    output_pdf_file="invoice-zugferd.pdf",
    flavor="factur-x",
    level="en16931"
)
```

## Regulatory Timeline

| Date | Requirement |
|------|-------------|
| Nov 2020 | XRechnung mandatory for German federal authorities (Bund) |
| 2020-2023 | Most Länder and Kommunen adopt e-invoicing |
| Jan 2025 | B2B: All businesses must be able to **receive** e-invoices |
| Jan 2027 | B2B: Businesses with >€800K revenue must **send** e-invoices |
| Jan 2028 | B2B: All businesses must **send** e-invoices |

This means:
- **Now:** If you invoice a Behörde, you need XRechnung/ZUGFeRD EN16931
- **Soon:** Every German business will need to send structured e-invoices
- **Recommendation:** Start with XRechnung for B2G, prepare for B2B migration
