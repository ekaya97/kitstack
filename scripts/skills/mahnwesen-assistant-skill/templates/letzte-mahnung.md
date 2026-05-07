# Template: Letzte Mahnung (Final Dunning Letter)

Use this template as the absolute last warning before legal escalation. Tone: strict, legal, final. No more second chances.

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

**Betreff: Letzte Mahnung vor Einleitung rechtlicher Schritte — Rechnung {{RECHNUNGSNUMMER}}**

Sehr geehrte Damen und Herren,

trotz unserer wiederholten Zahlungsaufforderungen

- Zahlungserinnerung vom {{DATUM_ZAHLUNGSERINNERUNG}}
- 1. Mahnung vom {{DATUM_ERSTE_MAHNUNG}}
- 2. Mahnung vom {{DATUM_ZWEITE_MAHNUNG}}

ist die nachstehende Forderung weiterhin nicht beglichen worden:

| | |
|---|---|
| Rechnungsnummer | {{RECHNUNGSNUMMER}} |
| Rechnungsdatum | {{RECHNUNGSDATUM}} |
| Urspruenglicher Rechnungsbetrag | {{RECHNUNGSBETRAG}} EUR |
| Faelligkeitsdatum | {{FAELLIGKEITSDATUM}} |
| Im Verzug seit | {{VERZUGSBEGINN}} |

Seit dem {{VERZUGSBEGINN}} befinden Sie sich mit der Zahlung in Verzug (§286 BGB). Gemaess §288 BGB stehen uns Verzugszinsen sowie eine Mahnpauschale zu. Die aktuelle Gesamtforderung setzt sich wie folgt zusammen:

| Position | Betrag |
|----------|--------|
| Rechnungsbetrag | {{RECHNUNGSBETRAG}} EUR |
| Verzugszinsen ({{VERZUGSTAGE}} Tage, {{ZINSSATZ}} % p.a.) | {{VERZUGSZINSEN}} EUR |
| Mahnpauschale (§288 Abs. 5 BGB) | {{MAHNPAUSCHALE}} EUR |
| **Gesamtforderung** | **{{GESAMTBETRAG}} EUR** |

**Letztmalig fordern wir Sie auf, den Gesamtbetrag von {{GESAMTBETRAG}} EUR bis spaetestens zum {{NEUE_FRIST}} auf das folgende Konto zu ueberweisen:**

| | |
|---|---|
| Kontoinhaber | {{ABSENDER_NAME}} |
| IBAN | {{IBAN}} |
| BIC | {{BIC}} |
| Verwendungszweck | {{RECHNUNGSNUMMER}} / Letzte Mahnung |

Wir weisen ausdruecklich darauf hin, dass wir nach fruchtlosem Ablauf der vorgenannten Frist **ohne weitere Ankuendigung** folgende Massnahmen einleiten werden:

1. Beantragung eines **gerichtlichen Mahnbescheids** beim zustaendigen Mahngericht
2. Beauftragung eines **Rechtsanwalts** bzw. Inkassounternehmens mit der Durchsetzung unserer Forderung
3. Die dadurch entstehenden **zusaetzlichen Kosten** (Gerichtskosten, Anwaltsgebuehren, Inkassokosten) gehen vollstaendig zu Ihren Lasten

Bitte beachten Sie, dass die Verzugszinsen taeglich weiterlaufen und sich der Gesamtbetrag mit jedem Tag des Zahlungsverzugs erhoeht.

Wir empfehlen Ihnen dringend, die Zahlung innerhalb der gesetzten Frist vorzunehmen, um ein gerichtliches Verfahren und erhebliche Mehrkosten zu vermeiden.

Mit freundlichen Gruessen

{{ABSENDER_NAME}}

---

## Template Notes

**Additional placeholders (beyond 2. Mahnung):**
- `{{DATUM_ZWEITE_MAHNUNG}}` — Date the 2. Mahnung was sent (TT.MM.JJJJ)
- `{{MAHNPAUSCHALE}}` — Flat recovery fee:
  - B2B: "40,00" (§288 Abs. 5 BGB)
  - B2C: Remove this row entirely (Mahnpauschale does not apply to consumers)
- `{{GESAMTBETRAG}}` — Total: Rechnungsbetrag + Verzugszinsen + Mahnpauschale

**Deadline guidance:** Set `{{NEUE_FRIST}}` to 5-7 days from the letter date. This is deliberately short — it signals finality.

**B2C adjustments:**
- Remove the Mahnpauschale row from the table
- Remove "(§288 Abs. 5 BGB)" references
- Adjust the Gesamtbetrag accordingly

**If stages were skipped:**
- If no Zahlungserinnerung or 2. Mahnung was sent, remove the corresponding bullet points from the list of prior communications
- Ensure at least one Mahnung was sent before this letter — sending a letzte Mahnung as the first communication is legally problematic and practically counterproductive

**Delivery recommendation:** Send this letter via **Einschreiben mit Rueckschein** (registered mail with return receipt) to have proof of delivery. This is important if the case goes to court.

**After this letter:**
- If payment is not received by {{NEUE_FRIST}}, proceed to:
  - Gerichtliches Mahnverfahren (see `references/mahnbescheid-guide.md`)
  - Or engage Rechtsanwalt/Inkasso (see `references/inkasso-vs-anwalt.md`)
- Use `scripts/verzugszinsen-rechner.py` to calculate the updated interest amount on the date of filing
