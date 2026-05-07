# Template: 2. Mahnung (Second Dunning Letter)

Use this template after the 1. Mahnung was ignored. Tone: firm, urgent. This letter increases pressure and clearly warns of further consequences.

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

**Betreff: 2. Mahnung — Rechnung {{RECHNUNGSNUMMER}}**

Sehr geehrte Damen und Herren,

trotz unserer Zahlungserinnerung vom {{DATUM_ZAHLUNGSERINNERUNG}} und unserer 1. Mahnung vom {{DATUM_ERSTE_MAHNUNG}} haben wir bislang keinen Zahlungseingang fuer die folgende Rechnung verzeichnen koennen:

| | |
|---|---|
| Rechnungsnummer | {{RECHNUNGSNUMMER}} |
| Rechnungsdatum | {{RECHNUNGSDATUM}} |
| Rechnungsbetrag | {{RECHNUNGSBETRAG}} EUR |
| Faelligkeitsdatum | {{FAELLIGKEITSDATUM}} |
| Im Verzug seit | {{VERZUGSBEGINN}} |

Sie befinden sich seit dem {{VERZUGSBEGINN}} in Zahlungsverzug. Gemaess §288 BGB fallen auf den ausstehenden Betrag Verzugszinsen in Hoehe von {{ZINSSATZ}} % p.a. (Basiszinssatz {{BASISZINSSATZ}} % zzgl. {{AUFSCHLAG}} Prozentpunkte) an.

**Aktuelle Forderungsuebersicht:**

| Position | Betrag |
|----------|--------|
| Rechnungsbetrag | {{RECHNUNGSBETRAG}} EUR |
| Verzugszinsen ({{VERZUGSTAGE}} Tage) | {{VERZUGSZINSEN}} EUR |
| **Offene Gesamtforderung** | **{{GESAMTBETRAG}} EUR** |

Wir fordern Sie hiermit nachdrücklich auf, den Gesamtbetrag von **{{GESAMTBETRAG}} EUR** bis spaetestens zum **{{NEUE_FRIST}}** auf das folgende Konto zu ueberweisen:

| | |
|---|---|
| Kontoinhaber | {{ABSENDER_NAME}} |
| IBAN | {{IBAN}} |
| BIC | {{BIC}} |
| Verwendungszweck | {{RECHNUNGSNUMMER}} / 2. Mahnung |

Sollte der Betrag nicht fristgerecht eingehen, sehen wir uns gezwungen, weitere Schritte zur Durchsetzung unserer Forderung einzuleiten. Dies kann die Beauftragung eines Inkassounternehmens oder eines Rechtsanwalts sowie die Beantragung eines gerichtlichen Mahnbescheids umfassen. Die daraus entstehenden zusaetzlichen Kosten gehen zu Ihren Lasten.

Wir appellieren an Sie, die Angelegenheit noch auf diesem Wege zu klaeren und die Zahlung umgehend vorzunehmen.

Mit freundlichen Gruessen

{{ABSENDER_NAME}}

---

## Template Notes

**Additional placeholders (beyond 1. Mahnung):**
- `{{DATUM_ERSTE_MAHNUNG}}` — Date the 1. Mahnung was sent (TT.MM.JJJJ)
- `{{VERZUGSBEGINN}}` — Date Verzug began (TT.MM.JJJJ)
- `{{BASISZINSSATZ}}` — Current Basiszinssatz (e.g., "2,27")
- `{{AUFSCHLAG}}` — Surcharge: "9" for B2B, "5" for B2C
- `{{ZINSSATZ}}` — Total annual rate (e.g., "11,27" for B2B)
- `{{VERZUGSTAGE}}` — Number of days in Verzug
- `{{VERZUGSZINSEN}}` — Calculated Verzugszinsen amount
- `{{GESAMTBETRAG}}` — Total: Rechnungsbetrag + Verzugszinsen

**Deadline guidance:** Set `{{NEUE_FRIST}}` to 7-10 days from the letter date.

**Note on Mahnpauschale:** The 40 EUR Mahnpauschale (§288 Abs. 5 BGB) can be included here for B2B claims. However, many practitioners reserve it for the letzte Mahnung to maintain escalation pressure. If included, add a row to the Forderungsuebersicht table.

**Customization:**
- If the Zahlungserinnerung was skipped, remove its date reference
- Adjust the escalation language based on the debtor relationship — keep it professional but unambiguous
