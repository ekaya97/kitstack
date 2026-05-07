# §286 BGB — Verzug des Schuldners (Default of the Debtor)

This reference explains when a debtor is legally "in Verzug" (in default) under German law. This is the critical threshold: once Verzug begins, the creditor can claim Verzugszinsen (default interest) and, for B2B, the Mahnpauschale (40 EUR flat fee).

## The Core Rule: §286 Abs. 1 BGB

> The debtor is in default (Verzug) when they do not perform after receiving a Mahnung (formal demand for payment) that is due after the claim has become due.

**In plain language:** You send an invoice. The payment becomes due. You send a Mahnung. The debtor doesn't pay. Now they are in Verzug.

**Key requirement:** The claim must already be **faellig** (due) before a Mahnung can trigger Verzug. A Mahnung sent before the due date has no legal effect.

## When a Mahnung Is NOT Required: §286 Abs. 2 BGB

In several cases, Verzug begins **automatically** without the creditor having to send a Mahnung:

### 1. Kalendermäßig bestimmte Leistungszeit (Calendar-determined due date)
> §286 Abs. 2 Nr. 1: When a specific calendar date for payment is determined.

**Practical meaning:** If the invoice says "Zahlbar bis 15.03.2026" or the contract specifies a due date, the debtor is automatically in Verzug the day after that date passes without payment.

**Example:**
- Invoice dated 01.03.2026, payment term: "Zahlbar bis 31.03.2026"
- On 01.04.2026 the debtor is automatically in Verzug
- No Mahnung needed

### 2. Berechenbare Leistungszeit (Calculable due date)
> §286 Abs. 2 Nr. 2: When the due date can be calculated from a preceding event.

**Practical meaning:** "Zahlbar innerhalb von 14 Tagen nach Lieferung" — the due date is calculable from the delivery date. Verzug begins automatically after day 14.

**Example:**
- Delivery on 10.03.2026, payment term: "14 Tage nach Lieferung"
- Due date: 24.03.2026
- On 25.03.2026 the debtor is automatically in Verzug

### 3. Ernsthafte und endgueltige Erfuellungsverweigerung (Serious refusal to pay)
> §286 Abs. 2 Nr. 3: When the debtor seriously and definitively refuses to perform.

**Practical meaning:** If the debtor writes "I am not going to pay this invoice" — Verzug begins immediately, no Mahnung needed.

### 4. Besondere Gruende (Special reasons for immediate default)
> §286 Abs. 2 Nr. 4: When immediate default is justified by special reasons, weighing the interests of both parties.

**Practical meaning:** Rare — mainly relevant for urgent claims or when a Mahnung would be pointless.

## The 30-Day Rule: §286 Abs. 3 BGB

> The debtor of a monetary claim is in default at the latest 30 days after the due date AND receipt of the invoice (or equivalent payment schedule).

### B2B (Unternehmer): Automatic after 30 days
- Invoice sent and received
- 30 days pass without payment
- Verzug begins automatically on day 31
- **No Mahnung required**

### B2C (Verbraucher): Only with explicit notice
- The 30-day rule applies to consumers **only if** the invoice explicitly warns about the consequence:
  > "Bei Nichtzahlung innerhalb von 30 Tagen nach Faelligkeit und Zugang dieser Rechnung kommen Sie in Verzug."
- Without this notice on the invoice, a **Mahnung is required** to put the consumer in Verzug.

**This is the most common mistake freelancers make with B2C clients:** They assume Verzug starts automatically after 30 days, but for consumers, it doesn't — unless the invoice contained the warning.

## What Constitutes a Valid Mahnung?

A Mahnung is a clear, unambiguous demand for payment of a specific, due claim. Requirements:

1. **Clear identification of the claim** — invoice number, amount, what it's for
2. **Unambiguous demand for payment** — "Wir fordern Sie auf, den Betrag zu zahlen" (not just "reminder that payment is outstanding")
3. **The claim must already be due** — a Mahnung before the due date is legally meaningless
4. **Delivered to the debtor** — the Mahnung must actually reach the debtor (Zugang)

### What is NOT a valid Mahnung:
- A mere statement of account ("Kontoauszug")
- An invoice itself (an invoice is not a Mahnung)
- A casual mention in conversation ("By the way, you still owe me money")
- A Mahnung for the wrong amount or wrong invoice

## Practical Decision Tree

```
Is the invoice due?
├── No → Wait. No Verzug possible yet.
└── Yes → Does the invoice/contract specify a calendar due date?
    ├── Yes → Verzug begins automatically the day after the due date.
    └── No → Is the debtor a business (B2B)?
        ├── Yes → Verzug begins automatically 30 days after due date + receipt.
        └── No (B2C) → Did the invoice warn about the 30-day rule?
            ├── Yes → Verzug begins after 30 days.
            └── No → You must send a Mahnung to trigger Verzug.
```

## Practical Examples

### Example 1: Freelancer invoices a GmbH (B2B)
- Invoice dated 01.02.2026, "Zahlbar bis 28.02.2026"
- Due date is calendar-determined
- On 01.03.2026: Verzug begins automatically (§286 Abs. 2 Nr. 1)
- No Mahnung required, but sending a Zahlungserinnerung is good practice

### Example 2: Freelancer invoices a private person (B2C)
- Invoice dated 01.02.2026, "Zahlbar innerhalb von 14 Tagen"
- Due date: 15.02.2026
- No 30-day warning on the invoice
- On 16.02.2026: **No automatic Verzug** — consumer was not warned
- Freelancer must send a Mahnung to trigger Verzug
- After Mahnung is received and deadline passes: Verzug begins

### Example 3: B2B invoice with "zahlbar sofort"
- Invoice dated 01.02.2026, "Zahlbar sofort"
- "Sofort" is not a calendar date — some legal scholars debate whether this is kalendermäßig bestimmt
- **Safe approach:** Send a Mahnung to be certain. Or use "Zahlbar bis [specific date]" in future invoices.

### Example 4: Debtor refuses to pay
- Debtor emails: "Ich werde diese Rechnung nicht bezahlen."
- Verzug begins immediately (§286 Abs. 2 Nr. 3)
- No Mahnung needed — skip directly to legal escalation if appropriate

## Key Takeaways for the Skill

1. **Always determine when Verzug began** before calculating interest. If Verzug hasn't started, there are no Verzugszinsen.
2. **Ask whether the debtor is B2B or B2C** — the rules differ significantly.
3. **Check whether the invoice had a specific due date** — this determines whether Verzug is automatic.
4. **For B2C without a due date warning: a Mahnung is required** before interest can accrue.
5. **The Zahlungserinnerung is not a Mahnung in the legal sense** unless it contains an unambiguous payment demand. Best practice: send a friendly reminder first, then a formal Mahnung.

## Source

- §286 BGB (Buergerliches Gesetzbuch) — Verzug des Schuldners
- §287 BGB — Verantwortlichkeit waehrend des Verzugs
- §288 BGB — Verzugszinsen und sonstiger Verzugsschaden
