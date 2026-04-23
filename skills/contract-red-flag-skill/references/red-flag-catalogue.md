# Red Flag Catalogue

30+ problematic clause patterns organized by category. For each pattern: what it looks like, why it's dangerous, and what to do.

---

## Payment & Financial (8 patterns)

### 1. Extended Payment Terms
**Pattern:** "Payment shall be made within 60/90/120 days of invoice receipt."
**Risk:** RED (60+ days), YELLOW (45 days)
**Why dangerous:** Cash flow killer, especially for freelancers. 90-day terms mean you work for 3+ months before seeing money. Combined with a long project, you could be 5-6 months out of pocket.
**Action:** Negotiate to Net 14 or Net 30. If they insist on 45+, request a larger upfront payment (40-50%) to offset.

### 2. Pay-When-Paid
**Pattern:** "Payment is contingent upon [Client] receiving payment from its end client."
**Risk:** RED
**Why dangerous:** You have no relationship with their client and no visibility into their payment. You're absorbing their client's credit risk.
**Action:** Reject. Your payment terms should be independent of their client relationship. "Payment is due regardless of Client's receipt of payment from third parties."

### 3. Vague Acceptance Criteria
**Pattern:** "Payment upon satisfactory completion of deliverables" without defining "satisfactory."
**Risk:** RED
**Why dangerous:** "Satisfactory" is subjective. Client can withhold payment indefinitely by claiming dissatisfaction.
**Action:** Replace with objective criteria: "Payment upon delivery of [specific deliverables] as described in Exhibit A. Client has 10 business days to review. Deliverables are deemed accepted if no written objection is received within 10 business days."

### 4. Automatic Price Reduction
**Pattern:** "If deliverables are not completed by [date], fees shall be reduced by X% per day/week."
**Risk:** RED
**Why dangerous:** Creates a penalty mechanism that incentivizes unreasonable deadlines and punishes you for delays that may be caused by the client's own review cycles.
**Action:** Remove or replace with mutual clause: "If delays are caused by Provider, parties will discuss timeline adjustment. If delays are caused by Client (e.g., late feedback), timeline extends accordingly."

### 5. Expense Pre-Approval Without Limits
**Pattern:** "All expenses require prior written approval" with no minimum threshold.
**Risk:** YELLOW
**Why dangerous:** Creates administrative overhead for minor expenses ($5 for stock photos, $20 for a domain). Slows down work.
**Action:** Add a threshold: "Expenses under EUR 100 are at Provider's discretion. Expenses over EUR 100 require prior written approval."

### 6. Right to Offset
**Pattern:** "Client may offset any amounts owed to Provider against claims Client may have against Provider."
**Risk:** RED
**Why dangerous:** Client can unilaterally reduce your payment based on disputed claims. You lose leverage to challenge.
**Action:** Remove or limit: "Offset is only permitted for undisputed and acknowledged claims."

### 7. No Late Payment Interest
**Pattern:** Payment terms stated but no consequence for late payment.
**Risk:** YELLOW
**Why dangerous:** No incentive for timely payment. In Germany, SS 288 BGB automatically provides for late payment interest (9% above base rate for B2B), but stating it in the contract makes it enforceable and visible.
**Action:** Add: "Late payments accrue interest at [X]% per month" or reference statutory interest.

### 8. Kill Fee Absence
**Pattern:** Termination clause exists but no compensation for work-in-progress.
**Risk:** RED (if no payment for WIP), YELLOW (if partial payment)
**Why dangerous:** Client can terminate mid-project and owe you nothing for completed phases.
**Action:** Add kill fee: "Upon termination, Client shall pay for all work completed through the termination date, plus [25-50]% of the remaining contract value as a termination fee."

---

## Intellectual Property (6 patterns)

### 9. Pre-Payment IP Transfer
**Pattern:** "All intellectual property created under this agreement shall vest in Client upon creation."
**Risk:** RED
**Why dangerous:** You lose IP rights before being paid. If the client never pays, they still own your work.
**Action:** "IP transfers to Client upon receipt of full payment. Until payment, Provider retains all rights."

### 10. Blanket IP Assignment (Including Pre-Existing IP)
**Pattern:** "Provider assigns all intellectual property, including any pre-existing tools, frameworks, or methodologies used in the deliverables."
**Risk:** RED
**Why dangerous:** You lose rights to your own tools, templates, and frameworks that you use across multiple clients.
**Action:** Add carve-out: "Pre-existing IP of Provider remains Provider's property. Client receives a perpetual, non-exclusive license to use pre-existing IP as embedded in the deliverables."

### 11. No Portfolio / Reference Rights
**Pattern:** "Provider shall not reference Client or display any deliverables without prior written consent."
**Risk:** YELLOW
**Why dangerous:** Prevents you from building your portfolio and marketing your services.
**Action:** Add: "Provider may reference the general nature of the engagement and display non-confidential deliverables in Provider's portfolio, subject to Client's reasonable approval."

### 12. Moral Rights Waiver
**Pattern:** "Provider waives all moral rights in the deliverables."
**Risk:** YELLOW (US/UK), GREEN (not applicable in Germany — moral rights are non-waivable under German law)
**Why dangerous:** Allows the client to modify, distort, or use your work in ways you might object to without attribution.
**Action:** In Germany, this clause is void anyway. In US/UK, negotiate to at least retain attribution rights.

### 13. IP Assignment for Ideas / Concepts Not Used
**Pattern:** "All ideas, concepts, and materials developed during the engagement, whether or not used in the final deliverables, are the property of Client."
**Risk:** RED
**Why dangerous:** Anything you brainstorm, sketch, or prototype — even if rejected — becomes the client's property. This could include ideas you later want to use elsewhere.
**Action:** Limit to: "IP assignment applies only to deliverables accepted and paid for by Client. Rejected concepts, unused sketches, and internal working documents remain Provider's property."

### 14. Open Source Restriction
**Pattern:** "Provider shall not use any open-source software in the deliverables."
**Risk:** YELLOW (for software projects)
**Why dangerous:** Nearly impossible to comply with in modern software development. React, Express, PostgreSQL drivers — everything has open-source dependencies.
**Action:** Replace with: "Provider may use open-source software with permissive licenses (MIT, BSD, Apache 2.0). Provider shall not use copyleft licenses (GPL) without Client's prior approval."

---

## Liability & Indemnification (5 patterns)

### 15. Unlimited Liability
**Pattern:** No liability cap stated, or "Provider shall be liable for all damages arising from the engagement."
**Risk:** RED
**Why dangerous:** A $10,000 project could expose you to millions in damages. Liability should be proportional to what you're being paid.
**Action:** Add cap: "Provider's total aggregate liability shall not exceed [1-2x] the total fees paid under this agreement." Also exclude consequential damages.

### 16. One-Sided Indemnification
**Pattern:** "Provider shall indemnify and hold harmless Client from any and all claims..." with no reciprocal indemnification.
**Risk:** RED
**Why dangerous:** You bear all financial risk for third-party claims, even if the client's actions contributed.
**Action:** Make it mutual: both parties indemnify each other for their own negligence and breaches. Or limit scope: "Provider indemnifies Client against third-party claims arising directly from Provider's deliverables, limited to the total fees paid."

### 17. No Consequential Damages Exclusion
**Pattern:** Contract doesn't exclude consequential, incidental, or indirect damages.
**Risk:** RED
**Why dangerous:** You could be liable for the client's lost profits, lost customers, or business interruption — damages that can be astronomical and unpredictable.
**Action:** Add: "Neither party shall be liable for indirect, incidental, consequential, special, or punitive damages, including lost profits or business interruption."

### 18. Warranty Beyond Deliverables
**Pattern:** "Provider warrants that the deliverables will achieve [business result] / increase revenue by X%."
**Risk:** RED
**Why dangerous:** You're guaranteeing business outcomes you don't control. A great website doesn't guarantee traffic. Great strategy doesn't guarantee execution.
**Action:** Limit warranty to: "Provider warrants that deliverables will conform to the specifications in the scope of work. Provider does not warrant specific business results."

### 19. Indemnification for Third-Party IP Without Limitation
**Pattern:** "Provider shall indemnify Client against any claim that the deliverables infringe third-party IP rights" — without limitation or qualifications.
**Risk:** YELLOW
**Why dangerous:** Standard clause, but dangerous without limits. If someone claims a patent infringement (which can be frivolous), you're on the hook for defense costs.
**Action:** Add qualifiers: "Provider indemnifies against IP claims arising from Provider's original work. Provider is not liable for infringement arising from Client's specifications, Client's modifications, or use beyond the agreed scope."

---

## Termination (4 patterns)

### 20. Termination for Convenience Without Compensation
**Pattern:** "Client may terminate this agreement at any time for any reason with [0-7] days notice."
**Risk:** RED
**Why dangerous:** Client can cancel after you've blocked your calendar, turned down other work, and done significant unpaid prep.
**Action:** Add kill fee: "Upon termination for convenience, Client pays for all completed work plus [25-50%] of the remaining contract value." Or require 30 days notice.

### 21. Vague Termination Triggers
**Pattern:** "Client may terminate if Provider's performance is unsatisfactory."
**Risk:** RED
**Why dangerous:** "Unsatisfactory" is undefined. Client can manufacture dissatisfaction to exit without paying.
**Action:** Replace with objective triggers: "Client may terminate for material breach, subject to 14-day cure period and written notice specifying the breach."

### 22. No Cure Period
**Pattern:** "Either party may terminate immediately upon breach."
**Risk:** RED
**Why dangerous:** A minor, fixable issue becomes grounds for immediate termination.
**Action:** Add cure period: "The breaching party has 14 days from written notice to cure the breach before termination takes effect."

### 23. Automatic Renewal Without Notice
**Pattern:** "This agreement renews automatically for successive [12-month] periods unless terminated [90] days before renewal."
**Risk:** YELLOW
**Why dangerous:** Easy to miss the termination window. You're locked in for another year.
**Action:** In Germany, check AGB rules — excessive auto-renewal periods may be void (SS 309 Nr. 9 BGB). Negotiate to: "Agreement renews monthly after the initial term, terminable with 30 days notice."

---

## Non-Compete & Exclusivity (4 patterns)

### 24. Broad Non-Compete
**Pattern:** "Provider shall not provide services to any competitor of Client for 24 months after termination."
**Risk:** RED
**Why dangerous:** Effectively prevents you from working in your industry for 2 years.
**Action:** Narrow the scope: limit duration (6 months max), geography, and definition of "competitor." In Germany, non-competes for freelancers are generally unenforceable without compensation (Karenzentschadigung). In California, non-competes are void.

### 25. Blanket Exclusivity
**Pattern:** "During the term, Provider shall work exclusively for Client."
**Risk:** RED (for freelancers)
**Why dangerous:** Transforms a freelance relationship into de facto employment without employment benefits.
**Action:** Remove, or limit to: "Provider shall not provide services to Client's direct competitors during the engagement" (name specific competitors).

### 26. Non-Solicitation of Any Employee
**Pattern:** "Provider shall not solicit any employee of Client for 24 months."
**Risk:** YELLOW
**Why dangerous:** Overly broad — you might not even know all their employees. Standard is limited to employees you directly work with.
**Action:** Narrow to: "Provider shall not directly solicit employees with whom Provider had material contact during the engagement, for 12 months after termination."

### 27. Non-Compete Without Compensation
**Pattern:** Non-compete clause with no compensation for the restriction period.
**Risk:** RED (especially in Germany)
**Why dangerous:** In Germany, post-contractual non-competes for employees require compensation (Karenzentschadigung) of at least 50% of the last salary. For freelancers, the same principle should apply — you're giving up income.
**Action:** In Germany, argue it's unenforceable without compensation. In other jurisdictions, negotiate compensation or removal.

---

## Scope & Deliverables (3 patterns)

### 28. Unlimited Revisions
**Pattern:** "Provider shall revise deliverables until Client is satisfied."
**Risk:** RED
**Why dangerous:** No endpoint. Client can request infinite revisions, essentially getting unlimited work for a fixed price.
**Action:** Specify rounds: "2 rounds of revisions included. Additional revisions billed at [rate]."

### 29. Scope Creep Language
**Pattern:** "...and any other tasks reasonably requested by Client in connection with the project."
**Risk:** RED
**Why dangerous:** "Reasonably requested" is subjective. This lets the client add unlimited tasks without additional compensation.
**Action:** Remove or replace with: "Additional tasks beyond the scope defined in Exhibit A will be handled through a written change order."

### 30. Satisfaction Clause Without Objectivity
**Pattern:** "Deliverables must be completed to Client's satisfaction."
**Risk:** RED
**Why dangerous:** Entirely subjective. No way to prove "satisfaction" was or wasn't achieved.
**Action:** Replace with: "Deliverables must conform to the specifications described in the scope of work. Client has [10] business days to provide specific written feedback."

---

## Miscellaneous (3 patterns)

### 31. Unilateral Amendment
**Pattern:** "Client reserves the right to modify these terms at any time."
**Risk:** RED
**Why dangerous:** Client can change the contract after signing without your consent.
**Action:** Replace with: "Amendments require written agreement of both parties."

### 32. Assignment Without Consent
**Pattern:** "Client may assign this agreement to any third party."
**Risk:** YELLOW
**Why dangerous:** You agreed to work for Company A. They can assign the contract to Company B, which might be a company you'd never choose to work with.
**Action:** Add: "Neither party may assign this agreement without the other party's prior written consent."

### 33. Survival Clauses Too Broad
**Pattern:** "Sections [long list] survive termination indefinitely."
**Risk:** YELLOW
**Why dangerous:** Some clauses should survive (confidentiality, IP ownership). But unlimited duration for indemnification, non-compete, or warranty is excessive.
**Action:** Add time limits: "Indemnification obligations survive for 12 months. Confidentiality survives for 3 years. IP ownership survives indefinitely."
