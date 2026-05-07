# Template: Zahlungserinnerung (Friendly Payment Reminder)

Use this template for the first contact after a missed payment. Tone: friendly, assumes oversight.

---

{{ABSENDER_NAME}}
{{ABSENDER_STRASSE}}
{{ABSENDER_PLZ}} {{ABSENDER_ORT}}
{{ABSENDER_TELEFON}}
{{ABSENDER_EMAIL}}

{{EMPFAENGER_NAME}}
{{EMPFAENGER_STRASSE}}
{{EMPFAENGER_PLZ}} {{EMPFAENGER_ORT}}

{{ORT}}, den {{DATUM}}

**Betreff: Zahlungserinnerung — Rechnung {{RECHNUNGSNUMMER}}**

Sehr geehrte Damen und Herren,

bei der Durchsicht unserer Buchhaltung ist uns aufgefallen, dass die folgende Rechnung noch nicht beglichen wurde:

| | |
|---|---|
| Rechnungsnummer | {{RECHNUNGSNUMMER}} |
| Rechnungsdatum | {{RECHNUNGSDATUM}} |
| Rechnungsbetrag | {{RECHNUNGSBETRAG}} EUR |
| Faelligkeitsdatum | {{FAELLIGKEITSDATUM}} |

Sicherlich handelt es sich um ein Versehen oder die Zahlung hat sich mit diesem Schreiben gekreuzt. Wir bitten Sie, den offenen Betrag in Hoehe von **{{RECHNUNGSBETRAG}} EUR** bis zum **{{NEUE_FRIST}}** auf das folgende Konto zu ueberweisen:

| | |
|---|---|
| Kontoinhaber | {{ABSENDER_NAME}} |
| IBAN | {{IBAN}} |
| BIC | {{BIC}} |
| Verwendungszweck | {{RECHNUNGSNUMMER}} |

Sollte die Zahlung bereits veranlasst sein, betrachten Sie dieses Schreiben bitte als gegenstandslos.

Fuer Rueckfragen stehen wir Ihnen selbstverstaendlich gerne zur Verfuegung.

Mit freundlichen Gruessen

{{ABSENDER_NAME}}

---

## Template Notes

**Placeholders:**
- `{{ABSENDER_NAME}}` — Your name or company name
- `{{ABSENDER_STRASSE}}` — Your street address
- `{{ABSENDER_PLZ}}` / `{{ABSENDER_ORT}}` — Your postal code and city
- `{{ABSENDER_TELEFON}}` / `{{ABSENDER_EMAIL}}` — Your contact details
- `{{EMPFAENGER_NAME}}` — Debtor's name or company name
- `{{EMPFAENGER_STRASSE}}` — Debtor's street address
- `{{EMPFAENGER_PLZ}}` / `{{EMPFAENGER_ORT}}` — Debtor's postal code and city
- `{{ORT}}` — City where the letter is written
- `{{DATUM}}` — Date of the letter (TT.MM.JJJJ)
- `{{RECHNUNGSNUMMER}}` — Invoice number
- `{{RECHNUNGSDATUM}}` — Invoice date (TT.MM.JJJJ)
- `{{RECHNUNGSBETRAG}}` — Invoice amount (formatted: 3.500,00)
- `{{FAELLIGKEITSDATUM}}` — Original due date (TT.MM.JJJJ)
- `{{NEUE_FRIST}}` — New payment deadline, typically 7-10 days from letter date
- `{{IBAN}}` / `{{BIC}}` — Bank account details

**Deadline guidance:** Set `{{NEUE_FRIST}}` to 7-10 days from the letter date.

**Tone:** Do NOT modify the friendly tone. Do NOT add legal threats or Verzugszinsen references.
