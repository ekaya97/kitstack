# Risk Scorer Sub-Agent

## Purpose

This sub-agent provides a systematic methodology for scoring individual contract clauses. It is invoked by the main Contract Red Flag Skill during clause-by-clause analysis.

## Scoring Framework

### Risk Levels

**GREEN — Standard / Acceptable**
- Clause follows industry norms
- Terms are within acceptable ranges (see `references/acceptable-ranges.md`)
- Balanced between both parties
- No action needed beyond noting the clause
- Example: "Payment within 30 days of invoice" / "Mutual confidentiality for 3 years"

**YELLOW — Unfavorable / Negotiate If Possible**
- Clause is one-sided but not dangerous
- Terms are outside standard ranges but within tolerable limits
- Accepting it won't cause significant harm
- Worth negotiating but acceptable if the other party won't budge
- Example: "Payment within 45 days" / "Non-compete for 6 months, named competitors only"

**RED — Dangerous / Must Address Before Signing**
- Clause creates disproportionate risk
- Terms far exceed acceptable ranges
- Could result in significant financial loss, IP loss, or legal liability
- Must be renegotiated, removed, or reviewed by a lawyer before signing
- Example: "Unlimited liability" / "IP assignment for all work including personal projects"

### Scoring Criteria

For each clause, evaluate against these 5 dimensions:

#### 1. Financial Exposure (0-3)
- 0: No financial impact
- 1: Minor financial impact (within normal business risk)
- 2: Significant financial impact (could affect your quarter/year)
- 3: Major financial exposure (could threaten your business)

#### 2. Imbalance (0-3)
- 0: Fully mutual / balanced
- 1: Slightly favors one party (standard in vendor-drafted contracts)
- 2: Clearly one-sided with no reciprocal protection
- 3: Entirely one-sided, other party has no equivalent obligation

#### 3. Ambiguity (0-3)
- 0: Clear and specific
- 1: Minor ambiguity (reasonable interpretation possible)
- 2: Significant ambiguity (multiple interpretations, potential for dispute)
- 3: Deliberately vague (could mean almost anything)

#### 4. Market Standard (0-3)
- 0: Standard clause, seen in 80%+ of similar contracts
- 1: Somewhat unusual but not rare
- 2: Unusual for this type of contract
- 3: Highly unusual, almost never seen in fair contracts

#### 5. Reversibility (0-3)
- 0: Easily reversible (can be terminated, unwound)
- 1: Reversible with some effort or cost
- 2: Difficult to reverse once in effect
- 3: Irreversible (IP assignment, waived rights, non-compete)

### Scoring to Risk Level

Calculate the total score (sum of 5 dimensions, max 15):

| Total Score | Risk Level | Label |
|-------------|-----------|-------|
| 0-4 | GREEN | Standard / Acceptable |
| 5-8 | YELLOW | Unfavorable / Negotiate |
| 9-15 | RED | Dangerous / Must Address |

### Automatic RED Triggers

Regardless of total score, the following patterns are ALWAYS RED:
- Unlimited liability
- IP assignment for work unrelated to the project
- Non-compete without compensation exceeding 12 months
- Unilateral contract amendment rights
- Pay-when-paid clauses
- Termination without compensation for completed work
- Liability for consequential damages without cap

### Automatic GREEN Triggers

Regardless of other factors, the following are ALWAYS GREEN:
- Mutual confidentiality with reasonable duration (2-5 years)
- Payment terms Net 14-30
- Liability cap at 1x contract value with consequential damages excluded
- Mutual termination with 30-day notice
- IP transfers upon full payment with pre-existing IP carve-out
- Standard force majeure clause
- Governing law matching the operational jurisdiction

## Output Format Per Clause

When scoring a clause, output:

```
### [Clause Title] — [GREEN/YELLOW/RED]

**Scores:** Financial(X) | Imbalance(X) | Ambiguity(X) | Market(X) | Reversibility(X) = Total: X

**What it says:** [1-2 sentence plain-language summary]

**Risk:** [Why this score, practical impact]

**Action:** Accept / Negotiate / Reject / Seek legal advice

**Suggested revision:** [If YELLOW or RED, proposed alternative language]
```

## Aggregation Rules

### Overall Contract Score

After scoring all clauses:

1. Count RED clauses
2. Count YELLOW clauses
3. Apply overall score:

| RED Count | YELLOW Count | Overall Assessment |
|-----------|-------------|-------------------|
| 0 | 0-2 | LOW — Safe to sign with minor adjustments |
| 0 | 3-5 | MEDIUM — Negotiate key terms |
| 1-2 | Any | HIGH — Address RED items before signing |
| 3+ | Any | DO NOT SIGN — Requires significant renegotiation or legal review |

### Interaction Effects

Some clause combinations are worse than their individual scores suggest:

- **Unlimited liability + no consequential damages exclusion** = escalate both to RED
- **Vague scope + unlimited revisions** = escalate both to RED
- **Auto-renewal + non-refundable fees + unilateral price increase** = escalate renewal to RED
- **IP assignment + no termination payment** = escalate both to RED (they get your work, you might not get paid)
- **Non-compete + exclusivity** = escalate both to RED (double restriction)
- **Confidentiality unlimited + no portfolio rights** = escalate portfolio restriction to RED

## Jurisdiction-Specific Adjustments

### German Law (BGB)
When scoring clauses under German law:
- Clauses void under AGB law (SS 305-310 BGB) should be noted as "likely unenforceable" but still scored for risk (because enforcement may be attempted)
- Non-competes without Karenzentschadigung: score as RED even if likely unenforceable
- Copyright assignment (instead of usage rights): note as incorrect under SS 29 UrhG but score the intended rights transfer

### US Law
When scoring under US law:
- "As is" warranty disclaimers are standard and enforceable for B2B — score as YELLOW, not RED
- Mandatory arbitration is common — score as YELLOW unless arbitration location is burdensome
- Work-for-hire claims: check if the work qualifies under 17 U.S.C. SS 101; if not, note it but score the assignment clause instead
- Non-competes: check state law (void in California, enforceable with limits elsewhere)

### UK Law
When scoring under UK law:
- Exclusion of liability for negligence causing death/injury is void (UCTA) — note it
- Reasonableness test applies to B2B limitation clauses (UCTA s.11) — clauses that fail reasonableness test should be noted
- IR35 considerations for contractor agreements — flag employment-like terms
