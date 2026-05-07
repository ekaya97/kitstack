# Example: Letzte Mahnung (Final Dunning Letter)

## User Input

> "Mueller GmbH has completely ignored everything. I sent a Zahlungserinnerung on March 29th and a 1. Mahnung on April 12th. No response at all. The 3,500 EUR from RE-2026-018 was due on March 15th. It's now May 7th. They're a GmbH. What are my options and can you write the final letter?"

## Gathered Information

| Field | Value |
|-------|-------|
| Debtor | Mueller GmbH |
| Invoice Number | RE-2026-018 |
| Amount | 3.500,00 EUR |
| Due Date | 15.03.2026 |
| Days Overdue | 53 Tage (15.03 - 07.05.2026) |
| Previous Reminders | Zahlungserinnerung 29.03.2026, 1. Mahnung 12.04.2026 |
| Debtor Type | B2B (GmbH) |

## Recommended Stage

**Letzte Mahnung** — Two prior communications were ignored. This is the final letter before legal escalation. The tone is strict and formal, with specific legal consequences named.

## Verzugszinsen Calculation

```
Rechnungsbetrag:        3.500,00 EUR
Verzugsbeginn:          16.03.2026 (Tag nach Faelligkeit, §286 Abs. 2 Nr. 1 BGB)
Berechnungsdatum:       07.05.2026
Tage im Verzug:         52

Basiszinssatz (H1/2026): 2,27%
Zinssatz (B2B):          2,27% + 9% = 11,27% p.a.
Tageszins:               3.500,00 x 0,1127 / 365 = 1,0808 EUR/Tag
Verzugszinsen:           1,0808 x 52 = 56,20 EUR
Mahnpauschale:           40,00 EUR (§288 Abs. 5 BGB)

Gesamtforderung:
  Rechnungsbetrag:       3.500,00 EUR
  Verzugszinsen:            56,20 EUR
  Mahnpauschale:            40,00 EUR
  ────────────────────────────────────
  Gesamt:                3.596,20 EUR
```

## Generated Letter

---

{{ABSENDER_NAME}}
{{ABSENDER_STRASSE}}
{{ABSENDER_PLZ}} {{ABSENDER_ORT}}

Mueller GmbH
{{EMPFAENGER_STRASSE}}
{{EMPFAENGER_PLZ}} {{EMPFAENGER_ORT}}

{{ORT}}, den 07.05.2026

**Betreff: Letzte Mahnung vor Einleitung rechtlicher Schritte — Rechnung RE-2026-018**

Sehr geehrte Damen und Herren,

trotz unserer Zahlungserinnerung vom 29.03.2026 und unserer 1. Mahnung vom 12.04.2026 ist die nachstehende Forderung weiterhin nicht beglichen worden:

| | |
|---|---|
| Rechnungsnummer | RE-2026-018 |
| Rechnungsdatum | 01.03.2026 |
| Urspruenglicher Rechnungsbetrag | 3.500,00 EUR |
| Faelligkeitsdatum | 15.03.2026 |

Seit dem 16.03.2026 befinden Sie sich mit der Zahlung in Verzug (§286 Abs. 2 Nr. 1 BGB). Gemaess §288 BGB stehen uns daher Verzugszinsen sowie eine Mahnpauschale zu. Die aktuelle Gesamtforderung setzt sich wie folgt zusammen:

| Position | Betrag |
|----------|--------|
| Rechnungsbetrag | 3.500,00 EUR |
| Verzugszinsen (52 Tage, 11,27% p.a.) | 56,20 EUR |
| Mahnpauschale (§288 Abs. 5 BGB) | 40,00 EUR |
| **Gesamtforderung** | **3.596,20 EUR** |

**Letztmalig fordern wir Sie auf, den Gesamtbetrag von 3.596,20 EUR bis spaetestens zum 14.05.2026 auf das folgende Konto zu ueberweisen:**

| | |
|---|---|
| Kontoinhaber | {{ABSENDER_NAME}} |
| IBAN | {{IBAN}} |
| BIC | {{BIC}} |
| Verwendungszweck | RE-2026-018 / Letzte Mahnung |

Wir weisen ausdruecklich darauf hin, dass wir nach fruchtlosem Ablauf der vorgenannten Frist **ohne weitere Ankuendigung** folgende Massnahmen einleiten werden:

1. Beantragung eines **gerichtlichen Mahnbescheids** beim zustaendigen Mahngericht
2. Beauftragung eines Rechtsanwalts mit der Durchsetzung unserer Forderung
3. Die dadurch entstehenden **zusaetzlichen Kosten** (Gerichtskosten, Anwaltsgebuehren) gehen zu Ihren Lasten

Bitte beachten Sie, dass die Verzugszinsen taeglich weiterlaufen und sich der Gesamtbetrag mit jedem Tag des Zahlungsverzugs erhoeht.

Wir empfehlen Ihnen dringend, die Zahlung fristgerecht vorzunehmen, um weitere Kosten und ein gerichtliches Verfahren zu vermeiden.

Mit freundlichen Gruessen

{{ABSENDER_NAME}}

---

## Why This Works

1. **Complete timeline documented** — references both prior communications with dates
2. **Full interest calculation shown** — the debtor sees the exact financial consequence
3. **Mahnpauschale included** — the 40 EUR B2B flat fee per §288 Abs. 5 BGB
4. **Very short deadline** — 7 days (14.05.2026), signaling urgency
5. **Specific legal consequences named** — Mahnbescheid, Rechtsanwalt, cost transfer
6. **"Ohne weitere Ankuendigung"** — makes clear there will be no more warnings
7. **Running interest reminder** — motivates immediate payment
8. **Professional throughout** — firm but never emotional or insulting

## What Changed from 1. Mahnung

| Aspect | 1. Mahnung | Letzte Mahnung |
|--------|-----------|---------------|
| Tone | Formal, businesslike | Strict, legal, final |
| Interest | Mentioned as possibility | Calculated with exact amount |
| Mahnpauschale | Not mentioned | Included (40 EUR) |
| Legal threats | "weitere Mahnkosten" | Specific: Mahnbescheid, Anwalt |
| Deadline | 14 days | 7 days |
| Escalation | Implied | Explicit and imminent |
| Total shown | Original amount only | Full breakdown with interest |

## Next Steps After This Letter

If payment is not received by 14.05.2026:

1. **File Mahnbescheid online** at https://www.online-mahnantrag.de (see `references/mahnbescheid-guide.md`)
   - Cost for 3,596.20 EUR Streitwert: ~107 EUR court fee
   - Processing time: 1-3 weeks
2. **Or engage a Rechtsanwalt** (see `references/inkasso-vs-anwalt.md`)
   - Out-of-court RVG fee for 3,596.20 EUR: ~254 EUR
3. **Document everything** — keep copies of all letters, dates, and delivery confirmations
