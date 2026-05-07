# Scope Definition Patterns

Frameworks and patterns for writing precise, enforceable scope definitions. The scope section is the most disputed part of any SOW -- getting it right prevents 80% of project conflicts.

---

## 1. The In/Out Scope Framework

Every SOW scope section has three parts: In Scope, Out of Scope, and Assumptions. None of them are optional.

### In Scope Rules

- **Number every item.** Numbered items are easier to reference in change orders and dispute resolution.
- **One deliverable per item.** "Design and develop the website" is two deliverables masquerading as one. Split them.
- **Quantify where possible.** "Up to 12 page templates," "3 rounds of revisions," "5 user interviews."
- **Specify format and medium.** "Delivered as a Figma file," "Deployed to client's AWS account," "Provided as a PDF report."
- **State the condition of completion.** What does "done" look like? "Deployed to production and passing all automated tests" is a completion condition. "Finished" is not.

**Example -- Web Development:**
1. Design of 12 unique page templates (Home, About, Services, Contact, Blog Index, Blog Post, Case Study, Team, Pricing, FAQ, Legal, 404) as high-fidelity Figma mockups with desktop (1280px) and mobile (375px) variants
2. Front-end development of all 12 templates using Next.js 14 with TypeScript
3. Integration with Sanity CMS for blog posts, case studies, and team member profiles
4. Contact form with email notification (via SendGrid) and CRM integration (HubSpot)
5. SEO implementation: meta tags, Open Graph tags, XML sitemap, robots.txt, structured data (Organization, Article, FAQ schemas)
6. Performance optimization targeting Lighthouse scores of 90+ across all four categories
7. Cross-browser testing: Chrome, Safari, Firefox, Edge (latest 2 versions each)
8. Deployment to Vercel with production and staging environments
9. 60-minute CMS training session (recorded) for client's content team
10. Technical documentation: deployment guide, environment variables, CMS content model reference

### Out of Scope Rules

- **Be explicit, not defensive.** Out of scope is not an adversarial section. It is a clarity section.
- **Include the obvious adjacent items.** If you are building a website, copywriting is the most common assumption gap. State it.
- **Offer alternatives where applicable.** "Native mobile app development (can be scoped as a follow-on project)" is more professional than just "No mobile app."
- **Reference common misunderstandings.** If clients in this project type frequently expect something that is not included, call it out.

**Example -- Web Development:**
- Copywriting and content creation (client provides all final copy; we provide content guidance and placeholder text)
- Photography and video production (client provides or sources all media assets)
- Native mobile application development (available as a separate engagement)
- Ongoing SEO strategy, link building, or content marketing (available as a monthly retainer)
- Email marketing setup or automation (available as a separate project)
- Third-party software licensing costs (CMS, hosting, email service, analytics)
- Ongoing hosting and maintenance beyond the 30-day warranty period (available as a retainer)
- E-commerce functionality, payment processing, or shopping cart features
- Accessibility audit and WCAG compliance beyond semantic HTML best practices (available as a separate audit)

### Assumptions Rules

- **Assumptions are the hidden risks.** Every assumption that breaks triggers a potential change order.
- **State assumptions as conditions.** "This SOW assumes that [condition]. If [condition] does not hold, a Change Order may be required."
- **Cover the four common categories:** client inputs, technical environment, timeline dependencies, and third-party services.

**Example -- Web Development:**
- Client will provide all final page copy, product photography, and team headshots by the end of Week 3. Delays in content delivery will extend the project timeline.
- Client's designated point of contact has authority to approve designs and make final decisions without requiring additional internal review cycles.
- Client will provide access to their domain registrar, DNS management, and hosting account within 5 business days of project kickoff.
- The existing CRM (HubSpot) API supports the required contact form integration. If custom development is needed for the CRM integration, a Change Order will be issued.
- No major changes to brand guidelines, visual identity, or messaging strategy will occur during the project. Mid-project rebranding requires a Change Order.
- Third-party services (Vercel, Sanity, SendGrid) will maintain their current API contracts and pricing during the project period.

---

## 2. Deliverable Specification Patterns

### The Five-Part Deliverable Spec

Every deliverable should answer five questions:

| Question | Element | Example |
|----------|---------|---------|
| **What?** | Description | "Brand guidelines document" |
| **How much?** | Quantity/Scope | "40-60 pages covering logo, color, typography, photography, tone of voice" |
| **In what form?** | Format | "Delivered as a PDF and editable InDesign file" |
| **How do we know it's done?** | Acceptance criteria | "Client approves after 2 rounds of revisions within 5-day review windows" |
| **When?** | Timeline | "Delivered at the end of Phase 3, Week 8" |

### Measurable vs. Subjective Criteria

**Measurable (use these):**
- "Page load time under 2 seconds on 4G connection"
- "All pages score 90+ on Google Lighthouse (Performance, Accessibility, Best Practices, SEO)"
- "Test coverage above 80% for all business logic modules"
- "Report contains analysis of no fewer than 5 competitor brands"
- "Dashboard displays data updated within the last 15 minutes"

**Subjective (avoid or reframe):**
- "Modern-looking design" -> "Design consistent with the approved mood board and style tile (reference: Appendix B)"
- "User-friendly interface" -> "Key user flows completable in under 3 clicks, validated by 5-person usability test with task completion rate above 85%"
- "High-quality code" -> "Code passes ESLint with zero errors, all functions documented with JSDoc, PR review approved by senior developer"
- "Comprehensive strategy" -> "Strategy document covering: market analysis (5+ competitors), target audience (3+ personas), channel recommendations (prioritized list with rationale), 12-month content calendar"

---

## 3. Revision and Feedback Patterns

### Revision Round Definition

A "revision round" must be defined in the SOW to prevent endless rolling feedback:

> A revision round consists of a single consolidated set of feedback delivered as one document (email, marked-up PDF, or project management comment thread) within the specified review period. Feedback received after the revision round is submitted, or feedback submitted across multiple separate communications, constitutes a new revision round.

### Standard Revision Framework

| Deliverable Type | Included Rounds | Review Period | Additional Round Cost |
|-----------------|----------------|---------------|----------------------|
| Design concepts | 2 rounds | 5 business days | EUR 500-1,500 per round |
| Written content | 2 rounds | 5 business days | EUR 300-800 per round |
| Development/code | 1 round (QA-based) | 5 business days | EUR 100-200/hour |
| Strategy documents | 2 rounds | 5 business days | EUR 500-1,000 per round |
| Final deliverables | 1 round (minor adjustments only) | 3 business days | Subject to Change Order |

### The Deemed-Accepted Clause

This clause protects the service provider from indefinite review cycles:

> If the Client does not provide written feedback or approval within [X] business days of deliverable submission, the deliverable shall be deemed accepted. Deemed acceptance triggers the associated milestone payment and authorizes the Service Provider to proceed to the next phase.

**Standard review periods by engagement size:**
- Under EUR 10K: 3 business days
- EUR 10K-50K: 5 business days
- Over EUR 50K: 10 business days

---

## 4. Scope Boundary Patterns by Project Type

### Web Development Boundaries
- **In:** design, development, CMS, basic SEO, deployment, training
- **Adjacent (decide explicitly):** copywriting, photography, advanced SEO, hosting, maintenance, accessibility audit, analytics setup
- **Out (almost always):** ongoing content creation, paid advertising, mobile apps, custom integrations beyond spec

### Brand Strategy Boundaries
- **In:** research, positioning, visual identity, guidelines document, core asset templates
- **Adjacent (decide explicitly):** website redesign, environmental/signage design, brand video, social media templates, brand training workshops
- **Out (almost always):** ongoing design work, advertising campaigns, PR strategy, product packaging

### Consulting Boundaries
- **In:** analysis, recommendations, deliverable documents, presentations
- **Adjacent (decide explicitly):** implementation support, change management, vendor selection, recruitment, training
- **Out (almost always):** execution of recommendations, technology implementation, ongoing advisory (unless retainer)

### Technology Implementation Boundaries
- **In:** requirements, architecture, development, testing, deployment, documentation
- **Adjacent (decide explicitly):** data migration, third-party integrations, performance tuning, security audit, team training, ongoing support
- **Out (almost always):** hardware procurement, software licensing costs, business process redesign, user acceptance testing execution (client responsibility)

---

## 5. Red Flags in Scope Requests

Watch for these in client briefs or conversations -- they indicate scope that needs careful definition:

1. **"And everything that goes with it"** -- expand into specific items or exclude explicitly
2. **"Make it look like [competitor site]"** -- define which specific elements are in scope (layout, feature set, visual style)
3. **"We might also need..."** -- either include it now with pricing or put it out of scope with a note
4. **"Just a small change"** -- define change thresholds; changes above threshold require a Change Order
5. **"Ongoing support"** -- define what, how much, for how long, and at what cost; never leave open-ended
6. **"We'll figure it out as we go"** -- insist on a discovery phase; scope the discovery and defer execution scope to a follow-on SOW
7. **"Budget is flexible"** -- pin down a range; flexible budgets become inflexible when the invoice arrives
8. **"ASAP"** -- translate into a specific date; "ASAP" has no contractual meaning
