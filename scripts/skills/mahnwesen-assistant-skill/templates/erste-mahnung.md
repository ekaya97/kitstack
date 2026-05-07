# Template: 1. Mahnung (First Formal Dunning Letter)

Use this template after the Zahlungserinnerung was ignored. Tone: formal, businesslike. This letter formally establishes Verzug if not already in effect.

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

**Betreff: 1. Mahnung — Rechnung {{RECHNUNGSNUMMER}}**

Sehr geehrte Damen und Herren,

leider muessen wir feststellen, dass trotz unserer Zahlungserinnerung vom {{DATUM_ZAHLUNGSERINNERUNG}} die folgende Rechnung weiterhin offen ist:

| | |
|---|---|
| Rechnungsnummer | {{RECHNUNGSNUMMER}} |
| Rechnungsdatum | {{RECHNUNGSDATUM}} |
| Rechnungsbetrag | {{RECHNUNGSBETRAG}} EUR |
| Faelligkeitsdatum | {{FAELLIGKEITSDATUM}} |

Wir muessen Sie darauf hinweisen, dass sich Ihre Zahlung im Verzug befindet. Gemaess §288 BGB sind wir berechtigt, Verzugszinsen in Hoehe von {{ZINSSATZ_BESCHREIBUNG}} ueber dem jeweiligen Basiszinssatz der Deutschen Bundesbank geltend zu machen.

Wir bitten Sie daher, den offenen Betrag in Hoehe von **{{RECHNUNGSBETRAG}} EUR** bis spaetestens zum **{{NEUE_FRIST}}** auf das folgende Konto zu ueberweisen:

| | |
|---|---|
| Kontoinhaber | {{ABSENDER_NAME}} |
| IBAN | {{IBAN}} |
| BIC | {{BIC}} |
| Verwendungszweck | {{RECHNUNGSNUMMER}} |

Bitte beachten Sie, dass bei weiterem Zahlungsverzug zusaetzlich Verzugszinsen und weitere Mahnkosten anfallen werden.

Sollte es Ihrerseits Gruende fuer die ausgebliebene Zahlung geben, bitten wir Sie, uns umgehend zu kontaktieren, damit wir gemeinsam eine Loesung finden koennen.

Mit freundlichen Gruessen

{{ABSENDER_NAME}}

---

## Template Notes

**Additional placeholders (beyond Zahlungserinnerung):**
- `{{DATUM_ZAHLUNGSERINNERUNG}}` — Date the Zahlungserinnerung was sent (TT.MM.JJJJ)
- `{{ZINSSATZ_BESCHREIBUNG}}` — Interest rate description:
  - B2B: "9 Prozentpunkten"
  - B2C: "5 Prozentpunkten"

**Deadline guidance:** Set `{{NEUE_FRIST}}` to 10-14 days from the letter date.

**Customization:**
- If the Zahlungserinnerung was skipped (e.g., invoice is already 30+ days overdue), remove the reference to "unserer Zahlungserinnerung vom..." and adjust to: "trotz Faelligkeit am {{FAELLIGKEITSDATUM}} die folgende Rechnung weiterhin offen ist"
- If the debtor is a known contact person, replace "Sehr geehrte Damen und Herren" with "Sehr geehrte/r Frau/Herr {{ANSPRECHPARTNER}}"

**Legal note:** This letter satisfies the Mahnung requirement of §286 Abs. 1 BGB. After receiving this letter and the deadline passing, the debtor is definitively in Verzug.
