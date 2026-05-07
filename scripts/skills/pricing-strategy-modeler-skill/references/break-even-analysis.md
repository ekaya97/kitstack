# Break-Even Analysis — Deep Reference

This document provides the formulas, worked examples, and common pitfalls for calculating break-even points for freelancers and agencies. Every pricing recommendation should start with a break-even calculation.

---

## Why Break-Even Matters

Most freelancers set rates based on what "feels right" or what competitors charge. Neither approach accounts for their actual cost structure. A freelancer charging €80/hr who only bills 20 hours/week with €3,500/month in costs is netting €34/hr before taxes. That's not a pricing strategy — it's a slow path to burnout.

Break-even analysis answers: **"What is the minimum I must charge to cover my costs and pay myself?"** Everything above break-even is profit.

---

## The Core Formula

```
Break-Even Hourly Rate = (Annual Fixed Costs + Desired Annual Salary) ÷ Annual Billable Hours
```

### Component Breakdown

**Annual Fixed Costs** — expenses you pay regardless of billable work:

| Category | Typical Range (Germany) | Notes |
|----------|----------------------|-------|
| Office/coworking | €0-600/month | Home office: €0-100; coworking: €200-500 |
| Software & tools | €100-500/month | Adobe, Figma, PM tools, hosting, email |
| Insurance | €200-600/month | Health, liability, disability (Kranken-, Haftpflicht-, BU-Versicherung) |
| Accounting/legal | €100-300/month | Steuerberater, legal templates |
| Equipment depreciation | €50-200/month | Laptop, monitor, peripherals (spread over 3 years) |
| Marketing/website | €50-200/month | Domain, hosting, portfolio, ads |
| Professional development | €50-200/month | Courses, books, conferences |
| Miscellaneous | €100-200/month | Banking fees, phone, travel, supplies |
| **Total range** | **€650-2,800/month** | **€7,800-33,600/year** |

**Desired Annual Salary** — what you want to take home after business costs but before personal taxes:

| Level | Annual Salary (Germany) | Monthly Net |
|-------|----------------------|-------------|
| Survival | €36,000 | €3,000 |
| Comfortable | €60,000 | €5,000 |
| Good | €84,000 | €7,000 |
| Excellent | €120,000 | €10,000 |

**Tax adjustment for Germany:**
Self-employed individuals pay income tax + solidarity surcharge + (optionally) church tax. Effective tax rate at €60,000-120,000 income is roughly 30-42%. You also pay full health insurance (~€400-900/month depending on income and insurer).

To net €60,000/year, you need gross income of approximately €85,000-90,000.

**Annual Billable Hours:**

| Utilization Level | Calculation | Annual Hours |
|-------------------|-------------|--------------|
| Aggressive (80%) | 46 weeks × 32 hrs | 1,472 |
| Realistic (70%) | 46 weeks × 28 hrs | 1,288 |
| Conservative (60%) | 46 weeks × 24 hrs | 1,104 |
| Part-time (50%) | 46 weeks × 20 hrs | 920 |

Note: 46 weeks = 52 weeks - 4 weeks vacation - 2 weeks sick/holiday buffer.

Non-billable time includes: sales/marketing, admin, invoicing, learning, email, travel, project management, revision rounds that exceed scope.

---

## Worked Example: Solo Freelance Developer (Germany)

**Inputs:**
- Location: Berlin
- Monthly fixed costs: €2,200 (coworking €300, software €250, insurance €500, accounting €200, equipment €150, marketing €100, PD €100, misc €200, health insurance €400)
- Desired annual salary (net): €70,000
- Gross needed for €70,000 net: ~€100,000 (accounting for income tax ~30%)
- Utilization: 70% (realistic)
- Working weeks: 46

**Calculation:**
```
Annual fixed costs: €2,200 × 12 = €26,400
Desired gross salary: €100,000
Total annual revenue needed: €126,400
Annual billable hours: 46 × 28 = 1,288

Break-even hourly rate: €126,400 ÷ 1,288 = €98.14/hr

With 20% profit margin: €98.14 × 1.20 = €117.77/hr → price at €120/hr
```

**Validation:**
```
At €120/hr × 1,288 hours = €154,560 annual revenue
Minus fixed costs: €154,560 - €26,400 = €128,160
Minus taxes (~30%): €128,160 × 0.70 = €89,712 net salary
Profit above target: €89,712 - €70,000 = €19,712 (buffer/savings)
```

---

## Worked Example: Small Design Agency (3 people)

**Inputs:**
- Location: Hamburg
- Team: owner + 2 employed designers
- Designer salaries: €48,000/year each (gross, before employer contributions)
- Employer costs (social security, etc.): ~21% of gross = €10,080 each
- Total staff cost: 2 × (€48,000 + €10,080) = €116,160
- Office: €1,200/month
- Software: €600/month (agency licenses)
- Insurance: €400/month (business liability, cyber, health for owner)
- Other overhead: €800/month (accounting, marketing, misc)
- Owner's desired salary: €90,000 net → ~€130,000 gross
- Billable team hours: 3 people × 1,200 hours each = 3,600 hours/year

**Calculation:**
```
Annual fixed costs:
  Staff: €116,160
  Office: €14,400
  Software: €7,200
  Insurance: €4,800
  Other: €9,600
  Owner salary: €130,000
  Total: €282,160

Break-even hourly rate: €282,160 ÷ 3,600 = €78.38/hr

With 25% profit margin: €78.38 × 1.25 = €97.97/hr → price at €100/hr
```

**Revenue projection at €100/hr:**
```
Annual revenue: 3,600 × €100 = €360,000
Minus all costs: €360,000 - €282,160 = €77,840 profit
Effective profit margin: 21.6%
```

---

## Worked Example: Part-Time Freelance Consultant

**Inputs:**
- Location: Munich
- Works 3 days/week (24 hours)
- Has other income (employed part-time elsewhere)
- Monthly fixed costs: €800 (home office, software, insurance supplement)
- Desired consulting income: €40,000 net/year → ~€57,000 gross
- Utilization: 65% of 24 hours/week = ~16 billable hours/week

**Calculation:**
```
Annual fixed costs: €800 × 12 = €9,600
Desired gross income: €57,000
Total revenue needed: €66,600
Annual billable hours: 46 × 16 = 736

Break-even hourly rate: €66,600 ÷ 736 = €90.49/hr

With 15% margin: €90.49 × 1.15 = €104.06 → price at €105/hr
```

---

## Variable Costs

Unlike fixed costs, variable costs change with the volume of work:

| Variable Cost | Example | How to Account |
|--------------|---------|----------------|
| Subcontractors | Hiring a copywriter for a project | Add to project cost, mark up 15-25% |
| Stock assets | Photos, fonts, templates | Add to project cost or absorb into overhead |
| Printing/production | Physical deliverables | Pass through to client at cost |
| Travel | Client site visits | Bill separately or include in project rate |
| Software licenses | Project-specific tools | Add to project cost |
| Hosting/infrastructure | Client-specific servers | Bill separately to client |

**Rule:** Variable costs should be passed through to the client or included in project pricing with a margin. They should NOT be absorbed into your hourly rate.

---

## Utilization Rate Deep Dive

Utilization rate is the single most important variable in pricing. A 10% change in utilization can mean a 15-20% change in income.

### What Counts as Non-Billable

| Activity | % of Time (typical) | Can You Reduce It? |
|----------|---------------------|-------------------|
| Sales/proposals | 10-15% | Partially (referrals reduce this) |
| Admin/invoicing | 5-10% | Yes (automate) |
| Marketing/content | 5-10% | Partially (batch and schedule) |
| Learning/development | 5-10% | No (this keeps you competitive) |
| Internal meetings | 3-5% | Yes (agency only) |
| Scope creep/unbilled work | 5-15% | Yes (better scoping) |
| Context switching | 3-5% | Yes (batch similar work) |

### Improving Utilization
1. **Track everything for 2 weeks.** Use Toggl or Clockify on ALL tasks, not just billable work. The data will be uncomfortable but clarifying.
2. **Automate admin.** Automated invoicing, proposal templates, contract templates, canned email responses.
3. **Raise prices instead of working more hours.** Going from €80/hr to €100/hr has the same revenue effect as increasing utilization from 70% to 87.5% — but one of those is sustainable.
4. **Fire bad clients.** Clients who consume disproportionate non-billable time (endless revisions, constant calls, scope creep) destroy your utilization.
5. **Batch similar tasks.** Do all proposals on Monday, all client calls on Tuesday, deep work Wed-Fri.

---

## Break-Even Cheat Sheet

For quick estimates, use this table (assumes 46 working weeks, realistic utilization):

| Monthly Costs | Desired Net Income | Utilization | Minimum Rate |
|--------------|-------------------|-------------|--------------|
| €1,500 | €40,000 | 70% | €68/hr |
| €2,000 | €50,000 | 70% | €80/hr |
| €2,500 | €60,000 | 70% | €93/hr |
| €3,000 | €70,000 | 70% | €105/hr |
| €2,000 | €60,000 | 60% | €98/hr |
| €2,500 | €80,000 | 70% | €109/hr |
| €3,000 | €100,000 | 70% | €128/hr |
| €3,500 | €120,000 | 75% | €140/hr |

*Note: "Desired Net Income" is after business costs but before personal income tax. To account for German income tax, multiply the desired net by ~1.4 to get the gross revenue needed.*
