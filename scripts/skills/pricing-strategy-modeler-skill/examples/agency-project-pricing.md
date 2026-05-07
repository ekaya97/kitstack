# Example: Agency Transitioning to Project-Based Pricing

## User Input

> I run a 5-person web development agency in Frankfurt. We've been charging hourly (€110/hr) since we started 3 years ago. Our team is me (full-stack dev + PM), 2 senior developers, 1 junior developer, and 1 designer. Monthly overhead is about €22,000 (salaries, office, tools, insurance). We build custom web applications, mostly for mid-market B2B companies. Average project is 3-4 months. I want to switch to project-based pricing because we're efficient but hourly punishes us for being fast. How should I structure this?

---

## Generated Output

# Pricing Transition Plan: Web Development Agency
## From Hourly to Project-Based

**Agency:** 5-person web development team | **Location:** Frankfurt
**Current Model:** €110/hr | **Target Model:** Project-based with phases
**Monthly Overhead:** €22,000

---

## 1. Current State Assessment

### Revenue Under Hourly Model

| Metric | Calculation | Result |
|--------|-------------|--------|
| Team size (billable) | 5 people | |
| Billable hours/person/week | 32 (80% utilization target) | |
| Billable hours/person/year | 32 × 46 weeks | 1,472 |
| Total agency billable hours | 1,472 × 5 | 7,360 |
| Hourly rate | €110 | |
| **Maximum annual revenue** | 7,360 × €110 | **€809,600** |
| Realistic (75% utilization) | 6,900 × €110 | **€759,000** |

### Cost Structure

| Cost Category | Monthly | Annual |
|--------------|---------|--------|
| Salaries + employer costs (4 employees) | €16,500 | €198,000 |
| Your salary (owner draw) | €0 (taken from profit) | |
| Office | €2,000 | €24,000 |
| Software & tools | €1,500 | €18,000 |
| Insurance & legal | €800 | €9,600 |
| Marketing & sales | €700 | €8,400 |
| Miscellaneous | €500 | €6,000 |
| **Total overhead** | **€22,000** | **€264,000** |

### Current Profitability

| Scenario | Revenue | Costs | Profit | Your Take-Home |
|----------|---------|-------|--------|---------------|
| Best case (80% util) | €809,600 | €264,000 | €545,600 | Depends on owner draw |
| Realistic (75% util) | €759,000 | €264,000 | €495,000 | |
| Worst case (65% util) | €658,000 | €264,000 | €394,000 | |

At 75% utilization and €110/hr, the agency generates approximately €495,000 in profit before your compensation and taxes. If you draw €120,000/year, that's €375,000 in pre-tax profit.

**The hourly ceiling problem:** Your maximum revenue is capped at ~€810,000 with 5 people at €110/hr. To grow beyond that, you either add people (more overhead) or raise the rate. Project pricing removes this ceiling by decoupling price from hours.

### The Efficiency Penalty

You mentioned being "punished for being fast." Let's quantify that:

| Scenario | Quoted Hours | Actual Hours | Revenue | Effective Rate |
|----------|-------------|--------------|---------|---------------|
| Average project (hourly) | 500 | 500 | €55,000 | €110/hr |
| Efficient project (hourly) | 500 est. | 380 actual | €41,800 | €110/hr |
| Efficient project (project-based) | N/A | 380 | €55,000 (fixed) | **€144.74/hr** |

On a typical project where you're 24% more efficient than estimated, project-based pricing earns you €13,200 more per project. Across 8-10 projects/year, that's €105,000-€132,000 in additional revenue.

---

## 2. Project Pricing Framework

### Step 1: Define Your Service Packages

Based on your typical B2B web application work, here are recommended standard packages:

| Package | Scope | Duration | Price Range |
|---------|-------|----------|-------------|
| **Discovery & Scoping** | Requirements gathering, technical architecture, project plan | 2-3 weeks | €8,000-15,000 |
| **Custom Web Application (Standard)** | Full-stack app, 5-10 core features, auth, admin panel | 3-4 months | €55,000-85,000 |
| **Custom Web Application (Complex)** | 10-20 features, integrations, complex business logic | 4-6 months | €85,000-140,000 |
| **MVP / Prototype** | Core feature set, proof of concept, investor-ready | 6-8 weeks | €25,000-40,000 |
| **Ongoing Development Retainer** | Maintenance, features, support | Monthly | €8,000-15,000/month |

### Step 2: Project Pricing Formula

For each project, calculate:

```
Base Price = Estimated Hours × Internal Rate (€130/hr)
Complexity Multiplier = 1.0 (standard) to 1.3 (complex)
Risk Buffer = +15-25% (for estimation uncertainty)
Project Price = Base Price × Complexity Multiplier × (1 + Risk Buffer)
```

**Why €130/hr internal rate, not €110?**
Your current hourly rate (€110) leaves efficiency gains on the table. The internal rate for project pricing should be 15-20% higher because:
- You bear estimation risk (that premium compensates for underestimates)
- The client gets cost certainty (a valuable feature)
- Your efficiency should benefit your business, not the client's budget

### Worked Example: Standard Web Application

| Phase | Team Members | Est. Hours | Internal Rate | Phase Price |
|-------|-------------|------------|---------------|------------|
| Discovery & Planning | You + Designer | 60 | €130 | €7,800 |
| UI/UX Design | Designer + You (review) | 80 | €130 | €10,400 |
| Frontend Development | Senior Dev + Junior Dev | 160 | €130 | €20,800 |
| Backend & API | You + Senior Dev | 140 | €130 | €18,200 |
| Integration & Testing | Full team | 60 | €130 | €7,800 |
| Deployment & Handoff | You + Senior Dev | 30 | €130 | €3,900 |
| **Subtotal** | | **530 hrs** | | **€68,900** |
| Risk buffer (+20%) | | | | €13,780 |
| **Project Price** | | | | **€82,680** |

Present as: **€82,500** (round to a calculated-feeling number)

If your team completes in 450 hours (which efficient teams do):
- Effective hourly rate: €82,500 ÷ 450 = **€183/hr** (vs. €110/hr under hourly)

---

## 3. Phase-Based Payment Structure

Never collect payment only at the end. Structure payments to match project phases:

| Payment | Trigger | Amount | % |
|---------|---------|--------|---|
| Payment 1 | Contract signed (before work begins) | €20,625 | 25% |
| Payment 2 | Discovery + Design approved | €20,625 | 25% |
| Payment 3 | Development milestone (core features demo) | €24,750 | 30% |
| Payment 4 | Final delivery + deployment | €16,500 | 20% |
| **Total** | | **€82,500** | **100%** |

### Why This Structure Works
- 25% upfront secures commitment and funds the first phase
- 25% at design approval ensures they're engaged before development begins
- 30% at the development milestone is the largest payment because it's the largest phase
- 20% at delivery (not 50%) — you're never out more than 20% if the client disappears

---

## 4. Scope Protection

The biggest risk in project pricing is scope creep. Protect yourself with these mechanisms:

### In Every Proposal

**In Scope:**
- [Specific list of features, pages, integrations]
- [Number of revision rounds per phase: 2]
- [Specific tech stack and platforms]
- [Testing: browser/device coverage]

**Out of Scope:**
- Features not listed in the scope document
- Content creation or copywriting
- Third-party API costs (passed through to client)
- Post-launch hosting and maintenance (available as retainer)
- SEO, analytics, or marketing integrations (available as add-on)

**Change Order Process:**
- Changes outside agreed scope are estimated separately
- Change orders are billed at €130/hr or as mini-projects
- Client approves change order in writing before work begins
- Changes to in-progress work may affect timeline

### Scope Approval Gate

Before development begins, require a signed scope document:
1. Feature list with acceptance criteria
2. Design mockups approved
3. Technical architecture approved
4. Client signs off: "This is what we're building"

This signature is your protection. When the client says "Can we also add X?", you can refer to the signed scope and present a change order.

---

## 5. Transition Plan

### Weeks 1-4: Preparation
- [ ] Define 4-5 standard project packages with price ranges
- [ ] Build an internal estimation spreadsheet: features → hours → phase → price
- [ ] Create a project proposal template with scope, phases, timeline, and pricing table
- [ ] Update your website: remove hourly rates, add project case studies with outcomes
- [ ] Draft a change order template

### Weeks 5-8: Soft Launch
- [ ] Quote the next new client inquiry using project-based pricing
- [ ] Continue hourly for existing clients (don't disrupt mid-project)
- [ ] Track internal hours on the first project-priced engagement to validate estimates
- [ ] Gather team feedback: is the estimation process working?

### Weeks 9-12: Full Transition
- [ ] All new projects are quoted project-based
- [ ] Communicate to existing hourly clients: "For your next project, we'll be quoting a fixed project price. This gives you cost certainty and us the flexibility to deliver efficiently."
- [ ] Offer existing retainer clients the option to switch to a monthly deliverables retainer (vs. hours-based)
- [ ] Review first 2-3 project-priced engagements: actual hours vs. estimates, profit per project

### Month 4+: Optimization
- [ ] Build an estimation database: actual hours per feature type, per phase
- [ ] Refine packages based on real data
- [ ] Introduce a formal discovery phase (paid, €8,000-12,000) for complex projects — this reduces estimation risk dramatically
- [ ] Consider hiring a PM to free your time from project management to sales and strategy

---

## 6. Projected Financial Impact

| Metric | Current (Hourly) | Year 1 (Project) | Year 2 (Optimized) |
|--------|-------------------|-------------------|---------------------|
| Revenue | €759,000 | €825,000-900,000 | €950,000-1,100,000 |
| Avg. effective hourly rate | €110 | €130-150 | €145-170 |
| Profit margin | ~35% | ~40-45% | ~45-50% |
| Projects per year | N/A (hourly) | 8-12 | 10-14 |
| Revenue per project | N/A | €70,000-95,000 | €75,000-100,000 |

The 10-30% revenue increase in Year 1 comes from efficiency capture alone — same work, same team, better pricing. Year 2 improvements come from better estimation, scope discipline, and higher-value project selection.

---

## 7. Handling Client Pushback

| Objection | Response |
|-----------|----------|
| "We prefer hourly — it's more transparent." | "I understand. With project pricing, you get full cost certainty upfront. We provide detailed phase breakdowns so you know exactly what you're paying for. And with milestone payments, you only pay for approved work." |
| "What if the project costs less than the quote?" | "Our project price reflects the full scope, quality assurance, and delivery commitment. If we're efficient, we reinvest that time into polish and testing — you get a better product." |
| "Can you just give us an hourly rate so we can compare?" | "We've found that hourly comparisons don't capture the full picture. A lower hourly rate with scope creep and timeline overruns costs more than a fixed project price. Our price is €82,500 for the full scope — that's the number to compare." |
| "Your competitor quoted less." | "Different agencies have different approaches, team structures, and quality levels. I'd encourage you to compare: scope of work, team seniority, change order process, and post-launch support. We're confident our proposal delivers the best value for this project." |
