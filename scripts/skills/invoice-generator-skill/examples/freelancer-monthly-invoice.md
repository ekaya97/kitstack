# Example: Freelancer Monthly Invoice

## User Input

> Rechnung für Müller & Partner GmbH. 40 Stunden UX Design im April, Stundensatz €110. Dazu ein Workshop-Tag für €950. Meine Adresse: Torstraße 123, 10119 Berlin. Steuernummer 27/456/12345, USt-IdNr DE123456789. IBAN DE89 3704 0044 0532 0130 00 bei der Commerzbank, BIC COBADEFFXXX. Zahlungsziel 14 Tage.

## Generated Invoice Data

```json
{
  "lang": "de",
  "currency": "EUR",
  "invoice_number": "RE-2026-004",
  "invoice_date": "2026-05-01",
  "service_date": "2026-04-30",
  "payment_days": 14,
  "tax_rate": 19,
  "sender": {
    "name": "Anna Schmidt",
    "address_line1": "Torstraße 123",
    "address_line2": "10119 Berlin",
    "contact": "anna@example.de",
    "tax_id": "27/456/12345",
    "vat_id": "DE123456789"
  },
  "client": {
    "name": "Müller & Partner GmbH",
    "address_line1": "Kaiserstraße 42",
    "address_line2": "60329 Frankfurt am Main"
  },
  "items": [
    {
      "description": "UX Design — App Redesign",
      "detail": "User Research, Wireframes, Prototypen (April 2026)",
      "quantity": 40,
      "unit_price": 110.00
    },
    {
      "description": "Stakeholder Workshop",
      "detail": "Ganztägiger Workshop inkl. Vorbereitung und Nachbereitung",
      "quantity": 1,
      "unit_price": 950.00
    }
  ],
  "bank": {
    "account_holder": "Anna Schmidt",
    "iban": "DE89 3704 0044 0532 0130 00",
    "bic": "COBADEFFXXX",
    "bank_name": "Commerzbank"
  }
}
```

## Generated Invoice Output

```
┌──────────────────────────────────────────────────────────────────────┐
│ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ (accent bar)                        │
│                                                                      │
│  Anna Schmidt                                    Rechnung            │
│  Torstraße 123                                                       │
│  10119 Berlin                           Rechnungsnr.  RE-2026-004   │
│  anna@example.de                        Datum         01.05.2026     │
│                                         Fällig        15.05.2026     │
│                                         Leistungsdatum 30.04.2026    │
│  ─────────────────────────────────────────────────────────────────   │
│                                                                      │
│  RECHNUNGSEMPFÄNGER            RECHNUNGSSTELLER                      │
│  Müller & Partner GmbH         Anna Schmidt                          │
│  Kaiserstraße 42               Torstraße 123                         │
│  60329 Frankfurt am Main       10119 Berlin                          │
│                                                                      │
│  ─────────────────────────────────────────────────────────────────   │
│  Beschreibung                      Menge  Einzelpreis     Betrag     │
│  ─────────────────────────────────────────────────────────────────   │
│  UX Design — App Redesign            40    110,00 €    4.400,00 €   │
│  User Research, Wireframes,                                          │
│  Prototypen (April 2026)                                             │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  Stakeholder Workshop                  1    950,00 €      950,00 €  │
│  Ganztägiger Workshop inkl.                                          │
│  Vorbereitung und Nachbereitung                                      │
│  ─────────────────────────────────────────────────────────────────   │
│                                                                      │
│                                  Zwischensumme     5.350,00 €       │
│                                  USt. 19%          1.016,50 €       │
│                                  ═══════════════════════════════     │
│                                  Gesamtbetrag      6.366,50 €       │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │ BANKVERBINDUNG              ZAHLUNGSBEDINGUNGEN             │     │
│  │ Anna Schmidt                Zahlbar innerhalb von 14 Tagen  │     │
│  │ IBAN: DE89 3704 0044        nach Rechnungserhalt.           │     │
│  │       0532 0130 00                                          │     │
│  │ BIC: COBADEFFXXX                                            │     │
│  │ Commerzbank                                                 │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                      │
│  Steuernummer: 27/456/12345 · USt-IdNr.: DE123456789                │
│                                                                      │
│                               Vielen Dank für Ihr Vertrauen.        │
└──────────────────────────────────────────────────────────────────────┘
```

## Text Summary (shown below artifact)

**Rechnung RE-2026-004** an Müller & Partner GmbH
- Netto: 5.350,00 €
- USt. 19%: 1.016,50 €
- **Gesamt: 6.366,50 €**
- Fällig: 15.05.2026

All §14 UStG mandatory fields are included. Ready to send.
