# Example: 1. Mahnung (First Formal Dunning Letter)

## User Input

> "Mueller GmbH still hasn't paid RE-2026-018 for 3,500 EUR. I sent a friendly Zahlungserinnerung on March 29th with a deadline of April 8th, but nothing came in. Now it's 4 weeks overdue. They're a B2B client."

## Gathered Information

| Field | Value |
|-------|-------|
| Debtor | Mueller GmbH |
| Invoice Number | RE-2026-018 |
| Amount | 3.500,00 EUR |
| Due Date | 15.03.2026 |
| Days Overdue | ~28 Tage |
| Previous Reminders | Zahlungserinnerung vom 29.03.2026 |
| Debtor Type | B2B (GmbH) |

## Recommended Stage

**1. Mahnung** — The friendly reminder was ignored. This letter formally establishes Verzug (if not already in effect) and introduces the legal framework. Tone shifts from friendly to formal and businesslike.

## Verzug Status

Mueller GmbH is already in Verzug since 15.04.2026 at the latest (30 days after invoice receipt per §286 Abs. 3 BGB, assuming the invoice was received around March 1). Since the invoice also had a specific due date (15.03.2026), Verzug actually began on 16.03.2026 per §286 Abs. 2 Nr. 1 BGB.

## Generated Letter

---

{{ABSENDER_NAME}}
{{ABSENDER_STRASSE}}
{{ABSENDER_PLZ}} {{ABSENDER_ORT}}

Mueller GmbH
{{EMPFAENGER_STRASSE}}
{{EMPFAENGER_PLZ}} {{EMPFAENGER_ORT}}

{{ORT}}, den 12.04.2026

**Betreff: 1. Mahnung — Rechnung RE-2026-018**

Sehr geehrte Damen und Herren,

leider muessen wir feststellen, dass trotz unserer Zahlungserinnerung vom 29.03.2026 die folgende Rechnung weiterhin offen ist:

| | |
|---|---|
| Rechnungsnummer | RE-2026-018 |
| Rechnungsdatum | 01.03.2026 |
| Rechnungsbetrag | 3.500,00 EUR |
| Faelligkeitsdatum | 15.03.2026 |

Wir muessen Sie darauf hinweisen, dass sich Ihre Zahlung im Verzug befindet. Gemaess §288 BGB sind wir berechtigt, Verzugszinsen in Hoehe von 9 Prozentpunkten ueber dem jeweiligen Basiszinssatz der Deutschen Bundesbank geltend zu machen.

Wir bitten Sie daher, den offenen Betrag in Hoehe von **3.500,00 EUR** bis spaetestens zum **26.04.2026** auf das folgende Konto zu ueberweisen:

| | |
|---|---|
| Kontoinhaber | {{ABSENDER_NAME}} |
| IBAN | {{IBAN}} |
| BIC | {{BIC}} |
| Verwendungszweck | RE-2026-018 |

Bitte beachten Sie, dass bei weiterem Zahlungsverzug zusaetzlich Verzugszinsen und weitere Mahnkosten anfallen werden.

Sollte es Ihrerseits Gruende fuer die ausgebliebene Zahlung geben, bitten wir Sie, uns umgehend zu kontaktieren, damit wir gemeinsam eine Loesung finden koennen.

Mit freundlichen Gruessen

{{ABSENDER_NAME}}

---

## Why This Works

1. **References the previous reminder** — "trotz unserer Zahlungserinnerung vom 29.03.2026" creates a documented timeline
2. **Formally states Verzug** — "Ihre Zahlung befindet sich im Verzug" is the key legal phrase
3. **References §288 BGB** — puts the debtor on notice about interest liability
4. **Specific new deadline** — 14 days from letter date (26.04.2026)
5. **Warning about further costs** — "Verzugszinsen und weitere Mahnkosten" signals escalation
6. **Door still open** — offers to discuss reasons and find a solution together
7. **No threat of legal action yet** — appropriate for 1. Mahnung

## What Changed from Zahlungserinnerung

| Aspect | Zahlungserinnerung | 1. Mahnung |
|--------|-------------------|-----------|
| Tone | "Sicherlich ein Versehen" | "Leider muessen wir feststellen" |
| Legal language | None | §288 BGB referenced |
| Verzug mention | No | Yes, explicitly stated |
| Interest warning | No | Yes, rate specified |
| Escalation hint | No | "weitere Mahnkosten" |
| Solution offer | Not needed | Yes, invites communication |

## Next Step

If no payment is received by 26.04.2026, escalate to **2. Mahnung** with accumulated interest calculation. If still unpaid after that, proceed to **letzte Mahnung** (see `examples/letzte-mahnung-example.md`).
