# Example: Freelancer XRechnung to Federal Authority

## User Input

> Ich muss eine XRechnung an das Bundesamt für Kartographie erstellen. Leitweg-ID ist 0204:991-54321-89. Bestellnummer BKG-2026-0815. Ich habe 40 Stunden IT-Beratung im April geleistet, Stundensatz €130. Meine Daten: Anna Schmidt Consulting, Torstraße 123, 10119 Berlin, USt-IdNr DE123456789, Steuernummer 27/456/12345. IBAN DE89 3704 0044 0532 0130 00, BIC COBADEFFXXX, Commerzbank.

## Information Extracted

- **Seller:** Anna Schmidt Consulting, Berlin
- **Buyer:** Bundesamt für Kartographie und Geodäsie (BKG)
- **Leitweg-ID:** 0204:991-54321-89 (this goes into BT-10)
- **Buyer reference:** Bestellnummer BKG-2026-0815
- **Service:** 40 hours IT consulting, April 2026, €130/hr
- **Tax:** Standard 19% (domestic B2G)

## Generated JSON Input for xrechnung-generator.py

```json
{
  "invoice_number": "RE-2026-042",
  "invoice_date": "2026-05-02",
  "due_date": "2026-05-16",
  "service_period_start": "2026-04-01",
  "service_period_end": "2026-04-30",
  "currency": "EUR",
  "buyer_reference": "0204:991-54321-89",
  "note": "Bestellnummer: BKG-2026-0815",
  "payment_terms": "Zahlbar innerhalb von 14 Tagen nach Rechnungserhalt.",
  "seller": {
    "name": "Anna Schmidt Consulting",
    "street": "Torstraße 123",
    "city": "Berlin",
    "postal_code": "10119",
    "country_code": "DE",
    "vat_id": "DE123456789",
    "tax_id": "27/456/12345",
    "email": "anna@schmidtconsulting.de",
    "endpoint_id": "anna@schmidtconsulting.de",
    "endpoint_scheme": "EM"
  },
  "buyer": {
    "name": "Bundesamt für Kartographie und Geodäsie",
    "street": "Richard-Strauss-Allee 11",
    "city": "Frankfurt am Main",
    "postal_code": "60598",
    "country_code": "DE",
    "endpoint_id": "0204:991-54321-89",
    "endpoint_scheme": "0204"
  },
  "items": [
    {
      "description": "IT-Beratung — Digitalisierung Fachverfahren",
      "name": "IT-Beratung",
      "quantity": 40,
      "unit_price": 130.00,
      "unit_code": "HUR",
      "tax_rate": 19
    }
  ],
  "payment": {
    "means_code": "30",
    "iban": "DE89370400440532013000",
    "bic": "COBADEFFXXX"
  }
}
```

## Generated XRechnung XML (abbreviated)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<ubl:Invoice xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
             xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
             xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">

  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>RE-2026-042</cbc:ID>
  <cbc:IssueDate>2026-05-02</cbc:IssueDate>
  <cbc:DueDate>2026-05-16</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:Note>Bestellnummer: BKG-2026-0815</cbc:Note>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>0204:991-54321-89</cbc:BuyerReference>

  <!-- Invoice Period -->
  <cac:InvoicePeriod>
    <cbc:StartDate>2026-04-01</cbc:StartDate>
    <cbc:EndDate>2026-04-30</cbc:EndDate>
  </cac:InvoicePeriod>

  <!-- Seller -->
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cbc:EndpointID schemeID="EM">anna@schmidtconsulting.de</cbc:EndpointID>
      <cac:PostalAddress>
        <cbc:StreetName>Torstraße 123</cbc:StreetName>
        <cbc:CityName>Berlin</cbc:CityName>
        <cbc:PostalZone>10119</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>DE123456789</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>Anna Schmidt Consulting</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>

  <!-- Buyer -->
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cbc:EndpointID schemeID="0204">0204:991-54321-89</cbc:EndpointID>
      <cac:PostalAddress>
        <cbc:StreetName>Richard-Strauss-Allee 11</cbc:StreetName>
        <cbc:CityName>Frankfurt am Main</cbc:CityName>
        <cbc:PostalZone>60598</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>Bundesamt für Kartographie und Geodäsie</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>

  <!-- Payment -->
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>
    <cac:PayeeFinancialAccount>
      <cbc:ID>DE89370400440532013000</cbc:ID>
      <cac:FinancialInstitutionBranch><cbc:ID>COBADEFFXXX</cbc:ID></cac:FinancialInstitutionBranch>
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>

  <!-- Tax Total: 40 × 130 = 5200, 19% = 988 -->
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">988.00</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">5200.00</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">988.00</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>19.00</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>

  <!-- Monetary Totals -->
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">5200.00</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">5200.00</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">6188.00</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">6188.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>

  <!-- Line Item -->
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="HUR">40</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">5200.00</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Description>IT-Beratung — Digitalisierung Fachverfahren</cbc:Description>
      <cbc:Name>IT-Beratung</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>19.00</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="EUR">130.00</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>

</ubl:Invoice>
```

## Validation Result

```
# XRechnung Validation Report

**Overall: PASS** — 15 passed, 0 warnings, 0 failed

## All Checks
- ✅ [XML-01] XML is well-formed
- ✅ [BT-24] XRechnung customization ID present
- ✅ [BT-1] Invoice number present: RE-2026-042
- ✅ [BT-2] Invoice date valid: 2026-05-02
- ✅ [BT-3] Invoice type: Commercial invoice (380)
- ✅ [BT-5] Currency: EUR
- ✅ [BT-10] Buyer reference (Leitweg-ID): 0204:991-54321-89
- ✅ [BT-27] Seller name: Anna Schmidt Consulting
- ✅ [BT-31/32] Seller tax identifier: DE123456789
- ✅ [BG-5] Seller address present (city: Berlin)
- ✅ [BT-44] Buyer name: Bundesamt für Kartographie und Geodäsie
- ✅ [BT-81] Payment means code: 30
- ✅ [BT-84] Payment account (IBAN): DE89370400440532013000
- ✅ [BT-110] Tax total: 988.00 EUR
- ✅ [CALC-01] Tax calculation consistent (net + tax = gross)
```

## Submission

This XML is ready for submission via:
1. **ZRE (Zentrale Rechnungseingangsplattform):** https://xrechnung.bund.de — upload the XML file
2. **Peppol:** If the authority supports Peppol, send via your Peppol access point
3. **Email:** Some Kommunen accept XRechnung as email attachment

The Leitweg-ID `0204:991-54321-89` routes it directly to the correct department at BKG.
