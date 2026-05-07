# Payment Terms Reference

## Standard Payment Terms

### By Convention

| Term | Meaning | When to Use |
|------|---------|-------------|
| **Net 7** | Due within 7 days | Rush projects, small amounts |
| **Net 14** | Due within 14 days | German freelancer default, recurring clients |
| **Net 30** | Due within 30 days | International standard, new relationships |
| **Net 60** | Due within 60 days | Enterprise clients, large invoices |
| **Due on receipt** | Immediately payable | One-time clients, small amounts, COD |
| **EOM** | End of month | Monthly recurring services |
| **15 MFI** | 15th of month following invoice | Corporate accounting cycles |

### German Phrasing

- **Net 14:** "Zahlbar innerhalb von 14 Tagen nach Rechnungserhalt."
- **Net 30:** "Zahlbar innerhalb von 30 Tagen nach Rechnungserhalt."
- **Due on receipt:** "Zahlbar sofort nach Rechnungserhalt."
- **With Skonto:** "2% Skonto bei Zahlung innerhalb von 7 Tagen, ansonsten zahlbar innerhalb von 30 Tagen netto."

### English Phrasing

- **Net 14:** "Payment due within 14 days of invoice date."
- **Net 30:** "Payment due within 30 days of invoice date."
- **Due on receipt:** "Payment due upon receipt of invoice."
- **With early payment discount:** "2% discount if paid within 7 days. Otherwise, payment due within 30 days."

---

## Skonto (Early Payment Discount)

### How It Works
Skonto is a discount offered for early payment. Common in German business culture, less common internationally.

### Common Structures

| Offer | Phrasing (DE) |
|-------|---------------|
| 2% / 7 days, net 30 | "2% Skonto bei Zahlung innerhalb von 7 Tagen, ansonsten zahlbar innerhalb von 30 Tagen netto." |
| 3% / 10 days, net 30 | "3% Skonto bei Zahlung innerhalb von 10 Tagen, netto 30 Tage." |
| 1% / 5 days, net 14 | "1% Skonto bei Zahlung innerhalb von 5 Tagen, netto 14 Tage." |

### When to Offer Skonto
- You need faster cash flow
- The client has a pattern of paying late
- The invoice is large enough that 2% is meaningful to the client
- You're dealing with a German corporate client (they expect it)

### When NOT to Offer Skonto
- Small invoices where 2% is trivial (e.g., 2% of €500 = €10)
- You're already on tight margins
- The client always pays on time anyway

---

## Late Payment — German Law (§§286-288 BGB)

### When Does Verzug (Default) Begin?

1. **With a due date on the invoice:** Automatically on the day after the due date (no reminder needed)
2. **Without a due date:** After 30 days from invoice receipt AND after at least one Mahnung (reminder)
3. **After a Mahnung:** Immediately upon receipt of the Mahnung, regardless of the 30-day rule

### Verzugszinsen (Default Interest)

The interest rate for late payment is legally defined:

| Debtor Type | Interest Rate | Legal Basis |
|-------------|--------------|-------------|
| **Consumer (B2C)** | Basiszinssatz + 5 percentage points | §288 Abs. 1 BGB |
| **Business (B2B)** | Basiszinssatz + 9 percentage points | §288 Abs. 2 BGB |

**Basiszinssatz** (base rate): Published by the Deutsche Bundesbank every January 1 and July 1. As of January 2026, it is 2.27%. Check [bundesbank.de](https://www.bundesbank.de) for the current rate.

### Example B2B Calculation
- Invoice: €5,000
- Due date: April 1
- Payment received: May 1 (30 days late)
- Basiszinssatz: 2.27%
- Rate: 2.27% + 9% = 11.27%
- Daily rate: 11.27% / 365 = 0.03088%
- Interest: €5,000 × 0.03088% × 30 = **€46.32**

### Mahnpauschale (§288 Abs. 5 BGB)

For B2B invoices, you can additionally claim a flat €40 Mahnpauschale ("dunning flat fee") per overdue invoice, regardless of the amount. This is on top of Verzugszinsen.

---

## Payment Methods on Invoices

### What to Include

| Method | Details to Show |
|--------|----------------|
| **Bank transfer (DE)** | IBAN, BIC, Bank name, Account holder |
| **Bank transfer (US)** | Account number, Routing number, Bank name |
| **Bank transfer (UK)** | Sort code, Account number, Bank name |
| **PayPal** | PayPal email address |
| **Wise / TransferWise** | Wise account details or payment link |

### Formatting Bank Details

**German style:**
```
Bankverbindung:
Anna Schmidt
IBAN: DE89 3704 0044 0532 0130 00
BIC: COBADEFFXXX
Commerzbank
```

**US style:**
```
Payment Details:
Bank: Chase Bank
Account: 123456789
Routing: 021000021
Account Holder: Jane Smith
```

**UK style:**
```
Payment Details:
Bank: Barclays
Sort Code: 20-00-00
Account: 12345678
Account Holder: Jane Smith
```

### IBAN Formatting
Always format IBANs in groups of 4 for readability:
- ✅ `DE89 3704 0044 0532 0130 00`
- ❌ `DE89370400440532013000`

---

## Recommended Defaults by Situation

| Situation | Recommended Terms |
|-----------|-------------------|
| German freelancer → German SME | Net 14, offer 2% Skonto / 7 days |
| German freelancer → German Konzern | Net 30 (they set the terms anyway) |
| German freelancer → US client | Net 30 in USD |
| German freelancer → UK client | Net 30 in GBP or EUR |
| US freelancer → US client | Net 30 |
| Agency → any client | Net 30, milestone-based for large projects |
| Retainer agreement | Due on 1st of month, auto-invoiced |
| First-time client | 50% upfront, 50% on delivery |
