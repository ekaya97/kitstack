# Example: Zahlungserinnerung (Payment Reminder)

## User Input

> "Mueller GmbH hasn't paid invoice RE-2026-018 for 3,500 EUR, it was due 2 weeks ago on March 15th. This is the first time — I haven't reminded them yet. They're a good long-term client."

## Gathered Information

| Field | Value |
|-------|-------|
| Debtor | Mueller GmbH |
| Invoice Number | RE-2026-018 |
| Amount | 3.500,00 EUR |
| Due Date | 15.03.2026 |
| Days Overdue | ~14 Tage |
| Previous Reminders | None |
| Relationship | Long-term client |
| Debtor Type | B2B (GmbH) |

## Recommended Stage

**Zahlungserinnerung** — First contact after a missed payment. The client is a long-term partner and this is the first occurrence. A friendly tone is appropriate.

## Generated Letter

---

{{ABSENDER_NAME}}
{{ABSENDER_STRASSE}}
{{ABSENDER_PLZ}} {{ABSENDER_ORT}}

Mueller GmbH
{{EMPFAENGER_STRASSE}}
{{EMPFAENGER_PLZ}} {{EMPFAENGER_ORT}}

{{ORT}}, den 29.03.2026

**Betreff: Zahlungserinnerung — Rechnung RE-2026-018**

Sehr geehrte Damen und Herren,

bei der Durchsicht unserer Buchhaltung ist uns aufgefallen, dass die folgende Rechnung noch nicht beglichen wurde:

| | |
|---|---|
| Rechnungsnummer | RE-2026-018 |
| Rechnungsdatum | 01.03.2026 |
| Rechnungsbetrag | 3.500,00 EUR |
| Faelligkeitsdatum | 15.03.2026 |

Sicherlich handelt es sich um ein Versehen oder die Zahlung hat sich mit diesem Schreiben gekreuzt. Wir bitten Sie, den offenen Betrag in Hoehe von **3.500,00 EUR** bis zum **08.04.2026** auf das folgende Konto zu ueberweisen:

| | |
|---|---|
| Kontoinhaber | {{ABSENDER_NAME}} |
| IBAN | {{IBAN}} |
| BIC | {{BIC}} |
| Verwendungszweck | RE-2026-018 |

Sollte die Zahlung bereits veranlasst sein, betrachten Sie dieses Schreiben bitte als gegenstandslos.

Fuer Rueckfragen stehen wir Ihnen selbstverstaendlich gerne zur Verfuegung.

Mit freundlichen Gruessen

{{ABSENDER_NAME}}

---

## Why This Works

1. **Friendly tone** — "Sicherlich handelt es sich um ein Versehen" assumes good faith
2. **No legal threats** — appropriate for a first reminder to a long-term client
3. **Clear identification** — invoice number, amount, and due date are all stated
4. **Specific deadline** — 10 days from the letter date (08.04.2026)
5. **Payment details included** — the debtor can pay immediately without looking anything up
6. **Escape clause** — "Sollte die Zahlung bereits veranlasst sein" avoids embarrassment if payment crossed in the mail
7. **No Verzugszinsen mention** — too early and too aggressive for a Zahlungserinnerung

## Next Step

If no payment is received by 08.04.2026, escalate to **1. Mahnung** (see `examples/erste-mahnung-example.md`).
