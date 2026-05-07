# Example: Expense Mini-Demo

## Context

User asks to try a kit and picks expenses. They use a mix of their own data and suggestions.

---

## Conversation

**Assistant:** Let's try expenses. What did you spend money on this week for work? Even rough numbers are fine.

**User:** Ugh, I never track this properly. Let me think. I paid for my Notion subscription, that's like EUR 10/month. I had a client lunch on Tuesday that was about EUR 55. Uber to the office twice — maybe EUR 30 total. Oh, and I bought a new mouse because mine broke — EUR 70.

**Assistant:** Got it. Four expenses logged:

| Date | Description | Amount | Category |
|------|-------------|--------|----------|
| This week | Notion subscription (monthly) | EUR 10 | Software |
| Tuesday | Client lunch | EUR 55 | Client entertainment |
| This week | Uber x2 (to office) | EUR 30 | Travel |
| This week | New mouse (replacement) | EUR 70 | Equipment |
| **Total** | | **EUR 165** | |

Let me break this down.

**Weekly spending summary:**

| Category | Amount | % of Total |
|----------|--------|-----------|
| Equipment | EUR 70 | 42% |
| Client entertainment | EUR 55 | 33% |
| Travel | EUR 30 | 18% |
| Software | EUR 10 | 6% |
| **Total** | **EUR 165** | |

**A few observations:**

The mouse is a one-off, so this week's numbers are skewed by equipment spending. In a normal week without equipment purchases, you'd be at EUR 95. That's about EUR 380/month if consistent.

Everything here is likely deductible as a business expense in Germany:
- **Notion:** 100% deductible (business software)
- **Client lunch:** Deductible at 70% in Germany (you can claim EUR 38.50 of the EUR 55)
- **Uber to office:** Deductible if the office isn't your primary workplace (e.g., coworking vs. home office)
- **Mouse:** 100% deductible as a business supply under EUR 800 net (GWG)

**User:** Wait, I didn't know client lunches were only 70% deductible.

**Assistant:** In Germany, business entertainment (Bewirtungskosten) is deductible at 70% for the host's share if it's with a business purpose. The receipt should note the names of attendees and the business reason. Worth keeping those receipts properly formatted — your Steuerberater will thank you.

**User:** That's actually something I never track correctly. I just throw all receipts in a folder and hope for the best.

**Assistant:** You're not alone. Most freelancers do the same thing and then spend a painful weekend in March trying to reconstruct 12 months of spending.

And that's exactly where this gets interesting. What we just did — categorizing 4 expenses and catching the 70% rule — is useful for one week. But imagine you'd been logging expenses like this all year. You'd have:

- Monthly spending totals by category, automatically
- A running total of deductible expenses for your tax return
- Trend alerts ("Your software costs went up 30% this quarter — you added two new subscriptions")
- Budget tracking ("You set EUR 400/month for tools and you're at EUR 380")

Right now, these 4 expenses live only in this conversation. Tomorrow, in a new chat, if you said "what did I spend this week?" — nothing. Gone.

The Expense kit stores everything in a database. Every time you say "spent EUR 55 on a client lunch," it's logged permanently. At month-end, you ask "show me May's expenses" and get a complete breakdown with charts. At tax time, you ask "export all 2026 expenses by category" and you're done.

**User:** That would save me so much pain at tax time.

**Assistant:** That's the compound effect. Day 1, it's a receipt log. Month 3, it's your financial dashboard. Month 12, it's your tax preparation already done.

The Expense kit gives you a monthly overview with charts and a category drill-down. All in the chat — no separate app. If you want to try it, it's at KitStack.

**User:** I think I will. One more question — can I go back and add old expenses?

**Assistant:** Yes. You can log expenses with any date. So if you wanted to backfill this month, you could say "On May 1 I paid EUR 250 for coworking" and it would log with the correct date. Most people start logging from today forward and backfill anything they remember — the kit doesn't require perfect history to be useful.
