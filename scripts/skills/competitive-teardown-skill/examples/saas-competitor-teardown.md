# Example: SaaS Competitor Teardown

## User Input

> Analyze my competitors. I'm building a feedback collection tool for SaaS companies — think in-app surveys, NPS, feature request boards. My main competitors are Hotjar, Canny, and UserVoice. I charge $49/month for startups and $199/month for growth teams. We're 4 people, bootstrapped.

---

## Generated Teardown

# Competitive Teardown: FeedbackLoop
## May 2026

---

## Market Overview

The SaaS feedback and voice-of-customer market is fragmented and expanding. Three forces are shaping it: (1) product-led growth requires continuous user feedback, making this a "must-have" for PLG companies, not a "nice-to-have"; (2) the market is splitting between point solutions (surveys only, NPS only, feature boards only) and integrated platforms trying to own the full feedback lifecycle; (3) AI is enabling automated sentiment analysis and prioritization, which raises customer expectations for what a feedback tool should do.

The competitive dynamic favors integrated players long-term, but the current market is full of customers stitching together 2-3 point solutions. This integration gap is the primary opportunity.

---

## Competitive Set

| Competitor | Type | Why included |
|-----------|------|-------------|
| Hotjar | Direct (partial) | Dominates surveys + behavior analytics, overlaps on in-app feedback |
| Canny | Direct | Feature request boards + prioritization. Strong in PLG SaaS. |
| UserVoice | Direct | Enterprise feature request and feedback management. Legacy player. |
| Typeform + manual tracking | Status quo | Many teams use a generic survey tool + spreadsheet for feature requests |

---

## Competitor Profiles

### Hotjar

| Field | Detail |
|-------|--------|
| **What they do** | In-app feedback widgets, surveys, and behavior analytics (heatmaps, session recordings). They're a behavior analytics company that added feedback, not a feedback company. |
| **Who they serve** | Product teams and marketers at B2B and B2C SaaS companies, 10-500 employees. Skewing toward mid-market. |
| **Positioning** | "Understand what users do on your site and what they think about it" — bundling behavior + opinion |
| **Pricing** | Free tier (limited), $32/month (Plus), $80/month (Business), custom enterprise. Behavior analytics and feedback are bundled. |
| **Estimated size** | ~200 employees, profitable, acquired by Contentsquare (2021). Significant resources. |
| **Strengths** | Brand recognition (>1M websites use Hotjar). Strong free-to-paid funnel. The behavior + feedback bundle is genuinely useful — you can see what someone did AND what they said. |
| **Weaknesses** | Feedback is a secondary feature, not their core product. No feature request board, no prioritization framework, no roadmap integration. Survey capabilities are basic compared to dedicated tools. They're optimizing for behavior analytics, not feedback depth. |
| **Threat level** | Medium — They have the distribution to add feedback features, but their focus is on analytics. They won't out-build you on feedback-specific capabilities unless they make a strategic pivot. |

### Canny

| Field | Detail |
|-------|--------|
| **What they do** | Feature request boards, changelogs, and roadmap sharing. Users can submit, vote on, and track feature requests. |
| **Who they serve** | Product teams at B2B SaaS companies, 20-200 employees. Strong in PLG companies. |
| **Positioning** | "Capture, organize, and analyze product feedback in one place" |
| **Pricing** | Free tier (limited), $79/month (Starter), $359/month (Growth), custom enterprise. Per-company, not per-seat. |
| **Estimated size** | ~30 employees, bootstrapped, profitable. Focused and disciplined. |
| **Strengths** | Best-in-class feature request boards. Clean UI. Strong integrations (Jira, Linear, Intercom). Changelog feature creates a feedback loop — users see their requests get built. Built a loyal community in the PLG SaaS space. |
| **Weaknesses** | No in-app surveys or NPS. Feedback collection is passive (users come to the board) not active (you go to users). Pricing jumped significantly — the $79-359 gap frustrates growing teams. No behavior analytics, so you can't connect feedback to user actions. |
| **Threat level** | High — They serve the same segment you do, they're bootstrapped and profitable (so not going anywhere), and they could add surveys to their platform faster than you can build a feature board as good as theirs. |

### UserVoice

| Field | Detail |
|-------|--------|
| **What they do** | Enterprise product feedback management — feature requests, prioritization, roadmap alignment. The original feature voting tool (founded 2008). |
| **Who they serve** | Product teams at mid-market to enterprise companies, 200-5000 employees. Often mandated by VP Product or CPO. |
| **Positioning** | "Product feedback management for enterprises that need to scale" |
| **Pricing** | Starts at $799/month. No free tier. No self-serve. Sales-led. |
| **Estimated size** | ~80 employees. Funded ($17M+). Revenue likely $10-15M ARR. |
| **Strengths** | Deep enterprise features: SSO, granular permissions, Salesforce integration, revenue-weighted feedback prioritization. Long tenure means institutional trust. If a VP of Product at a 1,000-person company needs a feedback tool, UserVoice is on the shortlist. |
| **Weaknesses** | UI feels dated. Pricing excludes startups and SMBs entirely. Implementation is slow and requires professional services. Has not innovated meaningfully in years — riding on enterprise lock-in. No modern survey capabilities. No behavioral data. |
| **Threat level** | Low — They serve a different segment (enterprise) and are unlikely to move downmarket. Their architecture and pricing model prevent them from competing at your price point. However, if your customers grow into enterprise, they'll evaluate UserVoice. |

---

## Feature Comparison

| Dimension | Weight | FeedbackLoop | Hotjar | Canny | UserVoice | Typeform + Sheet |
|-----------|--------|-------------|--------|-------|-----------|-----------------|
| In-app surveys (targeted, contextual) | Critical | Best | Good | (blank) | Basic | Basic |
| NPS collection + tracking | Critical | Good | Basic | (blank) | Basic | Basic |
| Feature request board | Important | Good | (blank) | Best | Best | (blank) |
| Feedback prioritization | Important | Good | (blank) | Good | Best | (blank) |
| Behavior analytics | Nice-to-have | (blank) | Best | (blank) | (blank) | (blank) |
| Roadmap sharing / changelog | Nice-to-have | (blank) | (blank) | Best | Good | (blank) |
| Integrations (Jira, Linear, Slack) | Important | Basic | Good | Best | Good | Basic |
| Setup speed | Important | Best | Good | Good | Basic | Best |
| AI analysis / sentiment | Nice-to-have | Good | Basic | Basic | Basic | (blank) |
| Price accessibility | Critical | Best | Good | Good | (blank) | Best |

**Key takeaway:** FeedbackLoop leads on active feedback collection (surveys + NPS) and price accessibility. Canny leads on passive feedback (boards + changelogs). Hotjar leads on behavioral context. No competitor integrates all three modes well. The integration gap is your strategic opportunity.

---

## Positioning Map

**Axes:** Active Feedback (surveys, NPS, in-app prompts) vs. Passive Feedback (boards, voting, requests)

```
High Active Feedback
     |
     |   FeedbackLoop
     |              Hotjar
     |
     |
     |
     |        Typeform
     |                    Canny
     |                           UserVoice
     |_________________________________________ High Passive Feedback
```

**What this shows:** The market is split. Active feedback tools (left side) and passive feedback tools (right side) rarely overlap. FeedbackLoop sits in the upper-left — strong on active, moderate on passive. Canny and UserVoice own the right side. Hotjar bridges but doesn't go deep on either. The upper-right quadrant (strong at both active AND passive) is empty. Moving there would make FeedbackLoop the only integrated feedback platform at the startup/growth price point.

---

## Pricing Comparison

| Competitor | Model | Starting Price | Mid-Tier | Enterprise | Notable |
|-----------|-------|---------------|----------|-----------|---------|
| Hotjar | Tiered, bundled with analytics | Free / $32/mo | $80/mo | Custom | Feedback is included with analytics — hard to price-compare in isolation |
| Canny | Tiered, per-company | Free / $79/mo | $359/mo | Custom | Massive gap between Starter and Growth. Many teams outgrow free but balk at $359. |
| UserVoice | Sales-led, annual contracts | $799/mo | ~$1,500/mo | Custom | Inaccessible to startups. 12-month minimum contracts. |
| **FeedbackLoop** | **Tiered, per-company** | **$49/mo** | **$199/mo** | **Not yet** | **Most accessible at the low end. Gap to enterprise is an opportunity.** |

**Pricing insight:** Canny's $79-to-$359 jump is a market opportunity. Teams with 50-150 users outgrow the Starter plan (limited features and integrations) but $359/month feels steep for a feature board. If FeedbackLoop's $199 plan includes feature boards AND surveys, you're priced exactly in Canny's gap — cheaper than their Growth tier, with more capabilities.

---

## Competitive Threat Ranking

| Rank | Competitor | Threat Level | Primary Risk |
|------|-----------|-------------|-------------|
| 1 | Canny | High | Closest to your segment. Could add surveys. Loyal community. |
| 2 | Hotjar | Medium | Distribution advantage. If they invest in feedback depth, they can reach your customers through their existing install base. |
| 3 | Status Quo (Typeform + Sheet) | Medium | Inertia. Teams that have "good enough" workflows are hard to convert. |
| 4 | UserVoice | Low | Different segment. Only relevant if your customers scale to enterprise. |

---

## Differentiation Opportunities

### Opportunity 1: The Integrated Feedback Platform

**What:** Become the only tool that combines active feedback (in-app surveys, NPS) with passive feedback (feature boards, voting) at a startup-accessible price.

**Why it works:** Canny has boards but no surveys. Hotjar has surveys but no boards. Customers currently use 2 tools. You can be 1 tool that replaces both.

**Evidence:** The positioning map shows an empty upper-right quadrant. No competitor occupies "strong at both active and passive feedback."

### Opportunity 2: Exploit Canny's Pricing Gap

**What:** Position FeedbackLoop's $199 Growth plan directly against Canny's $359 Growth plan. Include feature boards + surveys + NPS in one package.

**Why it works:** Canny's jump from $79 to $359 is a pain point that appears repeatedly in G2 reviews and Reddit threads. Teams that need more than the Starter plan are price-sensitive at the growth stage.

**Evidence:** Canny's pricing page, G2 reviews mentioning pricing frustration, Reddit threads asking for Canny alternatives.

### Opportunity 3: "From Feedback to Roadmap" Story

**What:** Position around the outcome (product decisions), not the input (feedback collection). "Don't just collect feedback — know what to build next."

**Why it works:** All competitors position around collection. None position around the decision. If you can add lightweight prioritization (impact vs. effort scoring, revenue-weighted requests), you own the outcome.

**Evidence:** UserVoice has prioritization but at enterprise prices. Canny has voting but not revenue-weighting. Nobody offers affordable prioritization for growth-stage teams.

---

## Strategic Recommendations

### Recommendation 1: Build Feature Boards to Close the Integration Gap

- **What to do:** Ship a feature request board with voting, status updates, and Jira/Linear sync within the next quarter.
- **Why:** This moves you into the empty upper-right quadrant of the positioning map. You become the only integrated feedback tool at your price point.
- **How:** Start with a minimal board (submit, vote, status). Don't try to match Canny's board features on day one. The integration with your existing surveys is the differentiator.
- **Risk:** Engineering effort is significant. You're a 4-person team. Scope it tightly. The board needs to be good, not best-in-class.
- **Priority:** Now — this is the single biggest strategic move.

### Recommendation 2: Position Directly Against Canny's $359 Tier

- **What to do:** Create a comparison page: "FeedbackLoop vs. Canny" that highlights your $199 plan includes surveys + boards (what Canny charges $359 for boards alone).
- **Why:** Captures teams outgrowing Canny Starter who balk at $359. Your combined offering at $199 is a clear value proposition.
- **How:** Write the comparison page. Target Canny-related keywords in content marketing. Monitor G2 review threads for Canny pricing complaints and engage.
- **Risk:** Canny could respond by lowering prices or adding a mid-tier plan. Have a response ready (your integration story is the moat, not price alone).
- **Priority:** After feature boards ship.

### Recommendation 3: Add Lightweight Prioritization

- **What to do:** Add impact/effort scoring and revenue-weighted request ranking. Not a full roadmap tool — just enough to answer "what should we build next?"
- **Why:** This is what product teams actually need. Feedback collection is a means to this end. Owning the decision point makes you stickier.
- **How:** Simple 2x2 matrix: impact (from feedback volume + revenue weight) vs. effort (manual estimate). Auto-rank requests. Ship as a beta feature in the Growth plan.
- **Risk:** Scope creep. This can expand into a full product management tool. Draw a clear line: prioritization yes, roadmap planning no. Stay in your lane.
- **Priority:** Next quarter.

---

## Your "Only" Statement

> "FeedbackLoop is the only feedback platform that combines in-app surveys, NPS, and feature request boards in one tool — for SaaS teams at $49-199/month."

**Validation:** This is genuinely true once feature boards ship. Hotjar doesn't have boards. Canny doesn't have surveys. UserVoice doesn't serve this price point. The statement holds.
