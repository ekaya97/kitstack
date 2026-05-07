# XRechnung Field Mapping

This document maps user-provided invoice data to XRechnung BT (Business Term) codes and their XML paths in UBL 2.1 format.

## Document Level

| User Input | BT Code | UBL 2.1 XML Path | Required | Notes |
|-----------|---------|-------------------|----------|-------|
| Invoice number | BT-1 | `cbc:ID` | Yes | Unique, sequential |
| Invoice date | BT-2 | `cbc:IssueDate` | Yes | YYYY-MM-DD |
| Invoice type | BT-3 | `cbc:InvoiceTypeCode` | Yes | Default: 380 |
| Currency | BT-5 | `cbc:DocumentCurrencyCode` | Yes | ISO 4217 (EUR) |
| Due date | BT-9 | `cbc:DueDate` | Recommended | YYYY-MM-DD |
| Buyer reference | BT-10 | `cbc:BuyerReference` | Yes | Leitweg-ID for B2G |
| Payment terms | BT-20 | `cac:PaymentTerms/cbc:Note` | Recommended | Free text |
| Notes | BT-22 | `cbc:Note` | No | Invoice-level note |
| XRechnung ID | BT-24 | `cbc:CustomizationID` | Yes | Fixed value (see below) |

### Fixed Values

```
BT-24 (CustomizationID):
urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0

BT-23 (ProfileID):
urn:fdc:peppol.eu:2017:poacc:billing:01:1.0
```

## Seller (BG-4)

| User Input | BT Code | UBL 2.1 XML Path | Required |
|-----------|---------|-------------------|----------|
| Company name | BT-27 | `cac:AccountingSupplierParty/cac:Party/cac:PartyLegalEntity/cbc:RegistrationName` | Yes |
| USt-IdNr | BT-31 | `cac:PartyTaxScheme[TaxScheme/ID='VAT']/cbc:CompanyID` | Yes* |
| Steuernummer | BT-32 | `cac:PartyTaxScheme[TaxScheme/ID='FC']/cbc:CompanyID` | Yes* |
| Electronic address | BT-34 | `cbc:EndpointID` | Yes |
| Street | BT-35 | `cac:PostalAddress/cbc:StreetName` | Yes |
| City | BT-37 | `cac:PostalAddress/cbc:CityName` | Yes |
| Postal code | BT-38 | `cac:PostalAddress/cbc:PostalZone` | Yes |
| Country | BT-40 | `cac:PostalAddress/cac:Country/cbc:IdentificationCode` | Yes |
| Contact name | BT-41 | `cac:Contact/cbc:Name` | No |
| Phone | BT-42 | `cac:Contact/cbc:Telephone` | No |
| Email | BT-43 | `cac:Contact/cbc:ElectronicMail` | No |

*At least BT-31 or BT-32 required. For EU cross-border: BT-31 (USt-IdNr) is mandatory.

### Seller Endpoint (BT-34) Scheme IDs

| Scheme | schemeID | Use |
|--------|----------|-----|
| Email | EM | Simple — use seller's email |
| German VAT ID | 9930 | For Peppol routing |
| DUNS | 0060 | Dun & Bradstreet number |
| GLN | 0088 | Global Location Number |

## Buyer (BG-7)

| User Input | BT Code | UBL 2.1 XML Path | Required |
|-----------|---------|-------------------|----------|
| Company name | BT-44 | `cac:AccountingCustomerParty/cac:Party/cac:PartyLegalEntity/cbc:RegistrationName` | Yes |
| Buyer VAT ID | BT-48 | `cac:PartyTaxScheme/cbc:CompanyID` | If applicable |
| Electronic address | BT-49 | `cbc:EndpointID` | Yes |
| Street | BT-50 | `cac:PostalAddress/cbc:StreetName` | Yes |
| City | BT-52 | `cac:PostalAddress/cbc:CityName` | Yes |
| Postal code | BT-53 | `cac:PostalAddress/cbc:PostalZone` | Yes |
| Country | BT-55 | `cac:PostalAddress/cac:Country/cbc:IdentificationCode` | Yes |

### Buyer Endpoint for B2G (Leitweg-ID)

```xml
<cbc:EndpointID schemeID="0204">0204:991-12345-67</cbc:EndpointID>
```

The schemeID `0204` indicates a Leitweg-ID routing identifier.

## Payment (BG-16)

| User Input | BT Code | UBL 2.1 XML Path | Required |
|-----------|---------|-------------------|----------|
| Payment method | BT-81 | `cac:PaymentMeans/cbc:PaymentMeansCode` | Yes |
| IBAN | BT-84 | `cac:PayeeFinancialAccount/cbc:ID` | Yes (for transfer) |
| BIC | BT-86 | `cac:FinancialInstitutionBranch/cbc:ID` | Recommended |

## Line Items (BG-25)

| User Input | BT Code | UBL 2.1 XML Path | Required |
|-----------|---------|-------------------|----------|
| Line number | BT-126 | `cac:InvoiceLine/cbc:ID` | Yes |
| Quantity | BT-129 | `cbc:InvoicedQuantity` | Yes |
| Unit | BT-130 | `@unitCode` on InvoicedQuantity | Yes |
| Line total | BT-131 | `cbc:LineExtensionAmount` | Yes |
| Item name | BT-153 | `cac:Item/cbc:Name` | Yes |
| Item description | BT-154 | `cac:Item/cbc:Description` | Recommended |
| Unit price | BT-146 | `cac:Price/cbc:PriceAmount` | Yes |
| Tax category | BT-151 | `cac:ClassifiedTaxCategory/cbc:ID` | Yes |
| Tax rate | BT-152 | `cac:ClassifiedTaxCategory/cbc:Percent` | Yes |

## Tax Totals (BG-23)

| User Input | BT Code | UBL 2.1 XML Path | Required |
|-----------|---------|-------------------|----------|
| Total tax | BT-110 | `cac:TaxTotal/cbc:TaxAmount` | Yes |
| Taxable amount | BT-116 | `cac:TaxSubtotal/cbc:TaxableAmount` | Yes |
| Tax per rate | BT-117 | `cac:TaxSubtotal/cbc:TaxAmount` | Yes |
| Category code | BT-118 | `cac:TaxCategory/cbc:ID` | Yes |
| Rate | BT-119 | `cac:TaxCategory/cbc:Percent` | Yes |

## Monetary Totals (BG-22)

| Calculation | BT Code | UBL 2.1 XML Path | Required |
|------------|---------|-------------------|----------|
| Sum of line totals | BT-106 | `cbc:LineExtensionAmount` | Yes |
| Total excl. tax | BT-109 | `cbc:TaxExclusiveAmount` | Yes |
| Total incl. tax | BT-112 | `cbc:TaxInclusiveAmount` | Yes |
| Amount due | BT-115 | `cbc:PayableAmount` | Yes |
