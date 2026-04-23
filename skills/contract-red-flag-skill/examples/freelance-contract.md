# Example: Freelance Contract Scan

## Input Contract

The user uploaded the following freelance services agreement:

---

> **SERVICES AGREEMENT**
>
> This Agreement is entered into between TechVenture GmbH ("Client") and [Contractor Name] ("Contractor") as of [Date].
>
> **1. Services.** Contractor shall provide web development services as described in Exhibit A, and any other tasks reasonably requested by Client in connection with the project. Services shall be performed at Client's offices in Berlin, Monday through Friday, during normal business hours (9:00-18:00).
>
> **2. Term.** This Agreement commences on [Date] and continues for 12 months, automatically renewing for successive 12-month periods unless terminated with 90 days written notice prior to the renewal date.
>
> **3. Compensation.** Client shall pay Contractor a monthly fee of EUR 6,000, payable within 60 days of invoice receipt. No late payment interest shall apply.
>
> **4. Intellectual Property.** All work product, ideas, concepts, code, designs, and materials created by Contractor during the term of this Agreement, whether or not related to the Services, shall be the exclusive property of Client. Contractor hereby assigns all rights, title, and interest, including all intellectual property rights and copyright, to Client upon creation. Contractor waives all moral rights.
>
> **5. Confidentiality.** Contractor shall not disclose any information received from Client, whether written or oral, for the duration of the engagement and for an unlimited period thereafter. Contractor shall not reference Client or the work performed in any portfolio, website, or marketing material without prior written consent.
>
> **6. Non-Compete.** During the term and for 24 months following termination, Contractor shall not provide services to any company operating in the technology sector within the European Union.
>
> **7. Liability.** Contractor shall be liable for all damages, losses, and costs arising from Contractor's performance of the Services, including indirect and consequential damages. Contractor shall indemnify and hold harmless Client from any third-party claims.
>
> **8. Termination.** Client may terminate this Agreement at any time with 7 days written notice. Upon termination, Contractor shall deliver all work product to Client. No additional compensation is due upon termination beyond payment for the current month.
>
> **9. Governing Law.** This Agreement is governed by the laws of Germany. Disputes shall be resolved by the courts of Berlin.
>
> **10. Amendments.** Client reserves the right to modify the terms of this Agreement at any time by providing written notice to Contractor.

---

## Generated Review

# Contract Review: Services Agreement — TechVenture GmbH

**Contract type:** Freelance Services Agreement
**Parties:** [Contractor Name] (you) <-> TechVenture GmbH (client)
**Jurisdiction:** German law (BGB), Courts of Berlin
**Date reviewed:** [Date]

> **Disclaimer:** This analysis identifies potential risk areas based on common contract patterns. It is not legal advice. For contracts with significant financial exposure or complex terms, consult a qualified Rechtsanwaltin/Rechtsanwalt.

---

## Overall Risk Score: HIGH — DO NOT SIGN WITHOUT LEGAL REVIEW

This contract contains multiple red-flag clauses that create disproportionate risk for the Contractor. Additionally, several provisions indicate **Scheinselbststandigkeit** (false self-employment), which carries serious legal consequences for both parties. At minimum, Sections 1, 4, 6, 7, 8, and 10 must be renegotiated before signing.

---

## Top Issues

1. **Scheinselbststandigkeit risk** (RED) — Fixed hours, fixed location, and monthly salary create a strong indicator of false self-employment.
2. **Blanket IP assignment** (RED) — Claims IP for ALL work "whether or not related to the Services," including pre-existing tools and personal projects.
3. **24-month EU-wide non-compete** (RED) — Effectively bars you from working in tech across the entire EU for 2 years, with no compensation.
4. **Unlimited liability** (RED) — No liability cap, includes consequential damages, one-sided indemnification.
5. **Unilateral amendment right** (RED) — Client can change the contract terms at any time.

---

## Clause-by-Clause Analysis

### Section 1: Services — RED

**What it says:** You provide web development services as described in Exhibit A, plus "any other tasks reasonably requested." You must work at Client's Berlin offices, Monday-Friday, 9:00-18:00.

**Risk — Scope Creep:** "Any other tasks reasonably requested" gives the Client unlimited ability to expand your workload without additional compensation. This is a blank check.

**Risk — Scheinselbststandigkeit:** Fixed location (Client's offices) and fixed hours (9-18, Mon-Fri) are two of the strongest indicators of false self-employment under German law. Combined with the monthly fee (Section 3), this arrangement closely resembles an employment relationship. The Deutsche Rentenversicherung could reclassify this as employment, resulting in:
- Back-payment of social security contributions (up to 4 years)
- Potential criminal liability for the Client (SS 266a StGB)
- Your loss of Freiberufler tax status

**Action:** NEGOTIATE CRITICAL CHANGES:
- Remove "any other tasks reasonably requested" — scope must be defined in Exhibit A
- Remove fixed hours and location: "Contractor determines the time, place, and manner of performing the Services"
- Add: "Contractor is free to provide services to other clients"
- Add: "Contractor uses their own equipment and tools"

**Suggested revision:** "Contractor shall provide the web development services described in Exhibit A. Contractor shall determine the time, place, and manner of performing the Services. Changes to scope require written agreement and may affect compensation."

---

### Section 2: Term — YELLOW

**What it says:** 12-month initial term, auto-renews for 12-month periods, requires 90 days notice to prevent renewal.

**Risk:** The auto-renewal is aggressive. 90 days notice before a renewal date means you must decide 3 months before the term ends whether to continue. If you miss the window, you're locked in for another year.

**Note (German AGB law):** If this contract qualifies as AGB (standard terms), SS 309 Nr. 9 BGB limits auto-renewal to 12 months maximum with a termination notice period of no more than 3 months. This clause is at the boundary — technically compliant but maximally aggressive.

**Action:** Negotiate to: "After the initial 3-month term, this agreement renews monthly and may be terminated by either party with 30 days written notice."

---

### Section 3: Compensation — RED

**What it says:** EUR 6,000/month, payable within 60 days of invoice. No late payment interest.

**Risk — Payment terms:** Net 60 means you wait 2 months for payment. Combined with the first month of work, you're 3 months out of pocket before receiving any payment.

**Risk — Late payment:** No interest clause removes the incentive for timely payment. However, under German law (SS 288 BGB), you have a statutory right to late payment interest (9 percentage points above the base rate for B2B), even if the contract doesn't mention it. The absence of a clause doesn't remove your statutory right, but including it makes enforcement easier.

**Risk — Scheinselbststandigkeit:** A fixed monthly fee without project-based deliverables looks like a salary, not a freelance fee.

**Action:** Negotiate:
- Payment terms to Net 14 or Net 30
- Add late payment interest clause (reference SS 288 BGB)
- Restructure as project-based or milestone-based compensation instead of monthly salary

---

### Section 4: Intellectual Property — RED

**What it says:** ALL work product, ideas, concepts, code, designs, and materials — "whether or not related to the Services" — become Client's property upon creation. Full assignment of all IP rights including copyright. Moral rights waiver.

**Risk — Overbroad scope:** "Whether or not related to the Services" means anything you create during the 12-month term — including personal projects, side projects, open-source contributions, and tools you use for other clients — would belong to TechVenture GmbH. This is extraordinarily aggressive.

**Risk — Pre-existing IP:** No carve-out for your pre-existing tools, frameworks, or libraries. If you use your standard development toolkit on this project, they claim ownership of it.

**Risk — Upon creation (not upon payment):** IP transfers immediately, not upon payment. If they don't pay, they still own your work.

**Risk — Moral rights:** Under German law (SS 14 UrhG), moral rights (Urheberpersonlichkeitsrecht) are not waivable. This clause is void as a matter of law, but its presence signals the Client's intent to maximize their rights.

**Risk — Copyright assignment:** Under German law (SS 29 UrhG), copyright itself is not transferable. Only usage rights (Nutzungsrechte) can be granted. This clause, as written, is not valid under German law — but a court would likely interpret it as a grant of exclusive, unlimited usage rights.

**Action:** REJECT AND REWRITE:

**Suggested revision:** "Contractor grants Client an exclusive, perpetual, worldwide license to use, modify, and distribute the deliverables described in Exhibit A, upon receipt of full payment for each deliverable. Pre-existing intellectual property of Contractor ('Contractor Tools') remains Contractor's property; Client receives a non-exclusive, perpetual license to use Contractor Tools as embedded in the deliverables. Work product unrelated to the Services is not covered by this Agreement. Contractor may reference the general nature of the work in Contractor's portfolio."

---

### Section 5: Confidentiality — YELLOW

**What it says:** No disclosure of any information, unlimited duration. No portfolio or reference use without written consent.

**Risk — Unlimited duration:** Indefinite confidentiality obligations are overbroad. Standard is 2-3 years post-termination for general business information, with genuine trade secrets potentially longer.

**Risk — No carve-outs:** Missing standard exceptions: information that becomes publicly available, information independently developed, information received from third parties, information required to be disclosed by law.

**Risk — Portfolio restriction:** You cannot reference this client or show any work from this engagement. This limits your ability to market your services.

**Action:** Negotiate:
- Duration: "3 years following termination of this Agreement"
- Add carve-outs: publicly available info, independently developed, third-party source, legal requirement
- Portfolio: "Contractor may reference the general nature of the engagement and display non-confidential deliverables in Contractor's portfolio with Client's prior approval, which shall not be unreasonably withheld."

---

### Section 6: Non-Compete — RED

**What it says:** 24 months post-termination, no services to any technology company in the EU.

**Risk:** This is one of the most aggressive non-compete clauses possible:
- **Duration:** 24 months is excessive by any standard
- **Geographic scope:** The entire European Union (27 countries)
- **Industry scope:** "Technology sector" is vague and encompasses nearly every modern company
- **No compensation:** Under German law (SS 74 HGB, applied by analogy to freelancers), post-contractual non-competes without Karenzentschadigung (at least 50% of last compensation) are generally unenforceable

**Analysis under German law:** This clause is almost certainly unenforceable:
1. No Karenzentschadigung — the most critical deficiency
2. Scope is unreasonably broad (all of tech, all of EU)
3. Duration exceeds reasonable limits

However, you should not rely on unenforceability — the other party could still attempt to enforce it, causing legal costs and stress.

**Action:** REJECT. Options:
- Remove entirely (best outcome)
- Narrow dramatically: "Contractor shall not provide services to [Name 3 specific competitors] for 6 months following termination. During this period, Client shall pay Contractor a monthly Karenzentschadigung of EUR 3,000."

---

### Section 7: Liability — RED

**What it says:** Unlimited liability for all damages including indirect and consequential damages. One-sided indemnification (you indemnify them, but not vice versa).

**Risk — Unlimited liability:** No cap on your financial exposure. A EUR 72,000/year contract (12 x EUR 6,000) could expose you to millions in claimed damages.

**Risk — Consequential damages:** You would be liable for their lost profits, business interruption, and other indirect losses — which could vastly exceed the project value.

**Risk — One-sided indemnification:** You protect them from third-party claims, but they don't protect you.

**German law note:** In AGB, exclusion of liability for Vorsatz (intent) and grobe Fahrlassigkeit (gross negligence) is void (SS 309 Nr. 7 BGB). Similarly, a clause making only one party liable while shielding the other may be considered an unangemessene Benachteiligung (SS 307 BGB).

**Action:** NEGOTIATE:

**Suggested revision:** "Each party's total aggregate liability under this Agreement shall not exceed the total fees paid in the 12 months preceding the claim. Neither party shall be liable for indirect, incidental, or consequential damages, including lost profits. Each party shall indemnify the other against third-party claims arising from its own negligence or breach of this Agreement."

---

### Section 8: Termination — RED

**What it says:** Client can terminate with 7 days notice. No additional compensation beyond the current month.

**Risk — Short notice:** 7 days is insufficient. You may have turned down other work, adjusted your schedule, and made commitments based on this contract.

**Risk — No kill fee:** Upon termination, you only receive the current month's payment. If you're 3 months into a project and the Client terminates, you've potentially lost months of planned income.

**Risk — One-sided:** Only Client has termination rights. Your termination rights are not mentioned.

**German law note:** For Werkvertrag, SS 648 BGB gives the Client a free right of termination but requires payment of the full agreed price minus saved expenses. If this qualifies as a Werkvertrag, the clause attempting to limit payment to "the current month" may be void.

**Action:** Negotiate:
- Mutual termination rights
- 30 days notice
- Kill fee: "Upon termination, Client pays all completed work plus 25% of remaining contract value"
- Or rely on SS 648 BGB and argue the payment limitation is void

---

### Section 9: Governing Law — GREEN

**What it says:** German law, Berlin courts.

**Analysis:** Standard and appropriate for a contract between a German company and a contractor likely based in Germany. No issues.

---

### Section 10: Amendments — RED

**What it says:** Client can modify the contract terms at any time with written notice.

**Risk:** This allows the Client to change your payment, scope, deadlines, or any other terms unilaterally. You have no consent right.

**German law note:** Under AGB law, unilateral amendment clauses are generally void (SS 308 Nr. 4 BGB — Anderungsvorbehalt).

**Action:** REJECT. Replace with: "Amendments to this Agreement require the written consent of both parties."

---

## Missing Protections

The following important provisions are absent from the contract:

1. **Data protection (DSGVO):** If you'll access Client's user data, customer data, or employee data, an Auftragsverarbeitungsvertrag (AVV) is legally required under Art. 28 DSGVO. Its absence could result in fines for both parties.

2. **Force majeure:** No clause addressing events beyond either party's control (illness, pandemic, natural disaster). Standard inclusion.

3. **Dispute resolution escalation:** No mediation or informal resolution step before court proceedings. Standard: "Parties shall attempt to resolve disputes through good-faith negotiation for 30 days before initiating legal proceedings."

4. **Contractor's termination right:** Only Client can terminate. Contractor has no stated right to exit the agreement.

5. **Insurance requirements:** No mention of professional liability insurance. This is neutral but worth noting — some contracts require it.

6. **Subcontractor clause:** No mention of whether you can use subcontractors. Ambiguity could become a dispute.

---

## Negotiation Talking Points

Use these as starting points for your conversation with TechVenture GmbH:

1. **Scheinselbststandigkeit (Sections 1 + 3):** "I want to make sure we're both protected from a Scheinselbststandigkeit classification by the Deutsche Rentenversicherung. The current terms around fixed hours, location, and monthly payment structure could trigger a review. I'd suggest we adjust the wording to reflect a genuine freelance relationship — flexible hours, location independence, and project-based milestones."

2. **IP Scope (Section 4):** "I'm happy to assign all IP rights for the deliverables defined in our scope of work. I'd like to carve out my pre-existing development tools and any personal projects that aren't related to our engagement. This is standard practice and protects both of us."

3. **Non-Compete (Section 6):** "A 24-month non-compete across all of EU tech is broader than I can agree to. I'd suggest we either remove it or narrow it to 3-5 named direct competitors for 6 months, with appropriate Karenzentschadigung."

4. **Liability (Section 7):** "I'd like to cap liability at the total fees paid under the agreement, which is standard for freelance engagements. I'd also suggest we make the indemnification mutual."

5. **Termination (Section 8):** "Could we extend the notice period to 30 days and make termination rights mutual? I'd also like to include a kill fee for termination without cause — payment for completed work plus 25% of the remaining term."

6. **Amendments (Section 10):** "Contract amendments should require both parties' agreement. I'd suggest we change this to: 'Amendments require written consent of both parties.'"
