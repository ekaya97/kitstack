# Example: SaaS Agreement Scan

## Input Contract

The user uploaded the following SaaS subscription agreement:

---

> **SAAS SUBSCRIPTION AGREEMENT**
>
> This Agreement is between CloudMetrics Inc., a Delaware corporation ("Provider"), and [Customer] ("Customer").
>
> **1. Services.** Provider grants Customer a non-exclusive, non-transferable right to access and use the CloudMetrics platform ("Service") during the Subscription Term. The Service is provided "as is" and "as available." Provider makes no warranties of any kind, express or implied, including merchantability, fitness for a particular purpose, or non-infringement.
>
> **2. Subscription Term & Renewal.** The initial term is 12 months from the Effective Date. This Agreement automatically renews for successive 12-month periods. Customer must provide written notice of non-renewal at least 60 days prior to the end of the then-current term. Fees for renewal terms are subject to a price increase of up to 10% upon 30 days notice.
>
> **3. Fees & Payment.** Customer shall pay the annual subscription fee as set forth in the Order Form. All fees are non-refundable. Payment is due within 30 days of invoice. Late payments accrue interest at 1.5% per month. Provider may suspend Service access for any unpaid balance exceeding 15 days past due.
>
> **4. Customer Data.** Customer retains ownership of all data submitted to the Service ("Customer Data"). Provider may use Customer Data in aggregated, anonymized form for product improvement, benchmarking, and marketing purposes. Upon termination, Customer Data will be deleted within 90 days. Customer may request a data export within 30 days of termination.
>
> **5. Security.** Provider maintains commercially reasonable security measures. Provider will notify Customer of any data breach affecting Customer Data within 72 hours of discovery. Provider's total liability for data breaches shall not exceed the fees paid by Customer in the 12 months preceding the breach.
>
> **6. Intellectual Property.** Provider retains all rights in the Service, including all improvements, modifications, and derivative works. Any feedback, suggestions, or feature requests provided by Customer become Provider's property without compensation.
>
> **7. Limitation of Liability.** IN NO EVENT SHALL PROVIDER'S TOTAL LIABILITY EXCEED THE FEES PAID BY CUSTOMER IN THE 12 MONTHS PRECEDING THE CLAIM. NEITHER PARTY SHALL BE LIABLE FOR INDIRECT, INCIDENTAL, CONSEQUENTIAL, SPECIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFITS, LOST DATA, OR BUSINESS INTERRUPTION. THIS LIMITATION APPLIES REGARDLESS OF THE THEORY OF LIABILITY.
>
> **8. Indemnification.** Customer shall indemnify, defend, and hold harmless Provider from any claims arising from (a) Customer's use of the Service, (b) Customer's violation of any law, or (c) Customer Data. Provider shall indemnify Customer against third-party claims alleging that the Service infringes such third party's intellectual property rights, provided Customer promptly notifies Provider and grants Provider sole control of the defense.
>
> **9. Termination.** Provider may terminate this Agreement immediately if Customer breaches any term and fails to cure within 10 days of written notice. Provider may also terminate immediately if Customer becomes insolvent or files for bankruptcy. Upon termination for any reason, all fees paid are non-refundable.
>
> **10. Governing Law.** This Agreement is governed by the laws of the State of Delaware, without regard to conflict of laws principles. Any dispute shall be resolved exclusively in the state or federal courts located in Wilmington, Delaware.
>
> **11. Miscellaneous.** Provider may modify these terms at any time by posting updated terms on its website. Continued use of the Service after modification constitutes acceptance. Provider may assign this Agreement without Customer's consent.

---

## Generated Review

# Contract Review: SaaS Subscription Agreement — CloudMetrics Inc.

**Contract type:** SaaS Subscription Agreement
**Parties:** [Customer] (you) <-> CloudMetrics Inc. (provider)
**Jurisdiction:** Delaware (US) law, Wilmington courts
**Date reviewed:** [Date]

> **Disclaimer:** This analysis identifies potential risk areas based on common contract patterns. It is not legal advice. For contracts with significant financial exposure or complex terms, consult a qualified attorney.

---

## Overall Risk Score: MEDIUM

This is a fairly standard SaaS agreement that favors the provider (CloudMetrics), which is typical — the vendor drafted it. Most terms are within industry norms for SaaS contracts, but several clauses deserve attention, particularly around data usage, auto-renewal traps, and the blanket "as is" warranty disclaimer. None of the issues are deal-breakers for a standard SaaS subscription, but enterprise customers or those with sensitive data should negotiate key terms.

---

## Top Issues

1. **Aggregated data usage for marketing** (YELLOW) — Provider can use your data (anonymized) for marketing and benchmarking without specific consent per use case.
2. **Auto-renewal with 60-day notice + 10% price increase** (YELLOW) — You could be locked into a more expensive renewal if you miss the notice window.
3. **Unilateral terms modification** (RED) — Provider can change the contract by posting on their website; your continued use is deemed acceptance.
4. **Assignment without consent** (YELLOW) — Provider can assign the contract to another company (e.g., after acquisition).
5. **90-day data deletion** (YELLOW) — Only 30 days to request export after termination; data deleted at 90 days.

---

## Clause-by-Clause Analysis

### Section 1: Services — YELLOW

**What it says:** You get access to the platform on a non-exclusive, non-transferable basis. Service is "as is" with no warranties.

**Risk:** The "as is" disclaimer removes all implied warranties — including that the software works, is suitable for your needs, or doesn't infringe on others' IP. This is common in SaaS agreements but means you have no contractual recourse if the platform doesn't perform as advertised.

**Note:** Under US law, "as is" clauses are broadly enforceable for B2B software. Under EU law (if you're EU-based), some of these warranty disclaimers may not be enforceable, especially if the provider markets specific capabilities.

**Action:** If the platform is critical to your operations, negotiate: "Provider warrants that the Service will perform materially in accordance with the documentation during the Subscription Term."

---

### Section 2: Subscription Term & Renewal — YELLOW

**What it says:** 12-month term, auto-renews for 12 months, 60-day notice to cancel, up to 10% price increase per renewal.

**Risk — Auto-renewal trap:** You must remember to cancel 60 days before your anniversary date or you're locked in for another year. Many companies miss this window.

**Risk — Price escalation:** 10% annual increase is at the high end of SaaS norms (standard is 3-7%). Over 5 years, your fee increases by 61% (compounding).

**German law note:** If you're an EU customer, this auto-renewal clause may be subject to local consumer protection rules. Under German AGB law (SS 309 Nr. 9 BGB), auto-renewal terms exceeding 12 months with more than 3 months notice are void for consumer contracts.

**Action:**
- Negotiate shorter renewal periods: "Agreement renews monthly after the initial term"
- Cap price increases: "Fee increases shall not exceed 5% per renewal term"
- Add a reminder obligation: "Provider shall notify Customer at least 90 days before the renewal date"

---

### Section 3: Fees & Payment — GREEN

**What it says:** Annual fee per Order Form, non-refundable, Net 30 payment, 1.5% monthly late interest, service suspension after 15 days overdue.

**Analysis:** These terms are standard for SaaS:
- Net 30 is reasonable
- 1.5% monthly late interest (18% annual) is at the high end but within norms
- Service suspension after 15 days overdue is standard
- Non-refundable fees are standard for annual SaaS subscriptions

**Action:** Accept. If paying annually, consider negotiating a monthly payment option or quarterly billing.

---

### Section 4: Customer Data — YELLOW

**What it says:** You own your data. They can use it in aggregated, anonymized form for product improvement, benchmarking, and marketing. Data deleted 90 days after termination. You have 30 days to request export.

**Risk — Aggregated data usage:** "Benchmarking and marketing purposes" means CloudMetrics could publish industry reports that include insights derived from your data. While anonymized, if you're in a niche industry, aggregated data could be identifiable.

**Risk — 30-day export window:** You have only 30 days after termination to request your data. If you miss this window, your data is deleted at 90 days with no recovery option.

**Risk — GDPR compliance:** If you're processing personal data of EU residents through CloudMetrics, you need a Data Processing Agreement (DPA) — this contract doesn't mention one. This is a legal requirement, not optional.

**Action:**
- Narrow data usage: "Provider may use Customer Data in aggregated, anonymized form for product improvement only. Use for benchmarking or marketing requires Customer's prior written consent."
- Extend export window: "Customer may request data export within 60 days of termination"
- Add: "Provider shall make available a DPA compliant with Article 28 GDPR upon Customer's request"

---

### Section 5: Security — GREEN

**What it says:** Commercially reasonable security. 72-hour breach notification. Liability for breaches capped at 12 months of fees.

**Analysis:** This is above-average for SaaS agreements:
- "Commercially reasonable" is standard (though vague)
- 72-hour breach notification aligns with GDPR requirements
- Capping breach liability at 12 months of fees is standard

**Action:** Accept. For enterprise deals, consider requesting: SOC 2 Type II audit report, encryption standards (at rest and in transit), and penetration test cadence.

---

### Section 6: Intellectual Property — YELLOW

**What it says:** Provider owns all IP in the platform. Your feedback becomes their property.

**Risk — Feedback ownership:** If you suggest a feature, file a bug report with a proposed fix, or share a workflow improvement, CloudMetrics owns it. This is standard in SaaS but worth noting — don't share proprietary process improvements as "feedback."

**Action:** Accept as standard, but be aware: don't share proprietary methodologies or competitive intelligence as "feature requests." If you want to protect specific innovations, keep them separate from your CloudMetrics interactions.

---

### Section 7: Limitation of Liability — GREEN

**What it says:** Total liability capped at 12 months of fees. No consequential damages for either party.

**Analysis:** Standard and balanced. The cap applies to both parties, and consequential damages are excluded mutually. This is industry standard for SaaS.

**Action:** Accept.

---

### Section 8: Indemnification — GREEN

**What it says:** You indemnify them for your misuse. They indemnify you for IP infringement claims.

**Analysis:** This is mutual and balanced. The provider takes responsibility for IP infringement (they should — it's their product), and you take responsibility for how you use the service. The requirement to grant them "sole control of the defense" is standard.

**Action:** Accept. Verify that the IP indemnification doesn't have excessive carve-outs (e.g., "except for use in combination with other products").

---

### Section 9: Termination — YELLOW

**What it says:** They can terminate if you breach and don't cure in 10 days. They can terminate if you become insolvent. All fees non-refundable.

**Risk — 10-day cure period:** Short for enterprise software. If the "breach" is a technical issue (e.g., exceeding usage limits), 10 days may not be enough to resolve.

**Risk — Non-refundable on termination:** If they terminate you for a minor breach, you lose the remainder of your annual subscription fee.

**Risk — No customer termination right:** This section only addresses Provider's termination rights. Your right to terminate is implicit (by not renewing) but not explicit.

**Action:**
- Extend cure period to 30 days: "fails to cure within 30 days of written notice specifying the breach in reasonable detail"
- Add pro-rata refund: "If Provider terminates for cause, Customer shall receive a pro-rata refund of prepaid fees for the unused portion of the Subscription Term"
- Add explicit customer termination right: "Customer may terminate for cause if Provider materially breaches and fails to cure within 30 days"

---

### Section 10: Governing Law — YELLOW

**What it says:** Delaware law, Wilmington courts.

**Risk (for non-US customers):** If you're based in Germany/EU, resolving disputes in Wilmington, Delaware is expensive and impractical. Flights, US attorneys, time zone challenges.

**Note:** For EU consumers, mandatory consumer protection laws of the consumer's residence apply regardless of choice-of-law clauses (EU Regulation 593/2008, Art. 6). However, this protection is weaker for B2B contracts.

**Action:** For small subscriptions (under $10K/year), this is standard and not worth negotiating — you're unlikely to litigate. For large contracts ($50K+/year), negotiate: "Disputes shall be resolved by arbitration under ICC rules, with the seat of arbitration in [neutral location]."

---

### Section 11: Miscellaneous — RED

**What it says:** Provider can modify terms at any time by posting on their website. Continued use = acceptance. Provider can assign the contract.

**Risk — Unilateral modification:** This means CloudMetrics can change pricing, data usage terms, liability limits, or any other term simply by updating their website. Your only option is to stop using the service — but you've already paid for an annual subscription (which is non-refundable).

**Risk — Assignment without consent:** If CloudMetrics is acquired by a company you don't trust (or a competitor), they can assign your contract — and your data — to the acquirer without your approval.

**Action:**
- Terms modification: "Material changes to these terms require 60 days prior written notice to Customer. Customer may terminate without penalty within 30 days of such notice if Customer does not accept the modified terms."
- Assignment: "Neither party may assign this Agreement without the other party's prior written consent, except in connection with a merger or acquisition of substantially all assets, provided the assignee agrees to all terms."

---

## Missing Protections

1. **SLA (Service Level Agreement):** No uptime commitment. Standard SaaS includes 99.5-99.9% uptime guarantee with service credits for downtime.

2. **Data Processing Agreement (DPA):** If you're processing personal data of EU residents, a DPA is legally required under GDPR Art. 28. Not included or referenced.

3. **Data residency:** No mention of where data is stored. For EU customers, data stored outside the EU requires additional legal safeguards (Standard Contractual Clauses or adequacy decision).

4. **Escrow provisions:** If CloudMetrics goes out of business, what happens to your data and access? Enterprise contracts often include source code escrow.

5. **Your termination rights:** Only Provider termination is addressed. Customer should have explicit termination for cause rights.

---

## Negotiation Talking Points

1. **Terms modification (Section 11):** "We need advance notice and opt-out rights for material changes to the terms. We'd propose 60 days written notice for material changes, with the ability to terminate without penalty if we don't accept the changes."

2. **Data usage (Section 4):** "We're comfortable with aggregated data for product improvement, but we'd like marketing and benchmarking usage to require our consent. Could we adjust the language to reflect that?"

3. **Auto-renewal (Section 2):** "Could you add a renewal reminder 90 days before the renewal date? We'd also like to cap annual price increases at 5%."

4. **SLA:** "We'd like to add a 99.5% uptime SLA with service credits. Is your standard SLA available as an addendum?"

5. **DPA:** "We process EU personal data and need a GDPR-compliant DPA. Do you have a standard DPA we can execute alongside this agreement?"
