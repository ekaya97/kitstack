# Example: Web Development SOW

## User Input

> Write a SOW for FreshFoods GmbH. They're an organic grocery delivery company in Berlin. We're rebuilding their website from scratch -- current WordPress site is slow, not mobile-friendly, and doesn't reflect their brand refresh from last year. New site on Next.js, headless CMS (Sanity), deployed to Vercel. Budget is EUR 35,000, timeline is 12 weeks. I'm a digital agency with a 3-person team (designer, developer, project manager).

---

## Generated SOW

# Scope of Work: FreshFoods GmbH Website Rebuild

**SOW Reference:** SOW-2026-001
**Effective Date:** [Date]
**Service Provider:** [Agency Name]
**Client:** FreshFoods GmbH
**Prepared by:** [Your Name], Project Lead

---

## 1. Project Overview

FreshFoods GmbH requires a complete rebuild of its public-facing website to replace the existing WordPress site, which no longer meets performance standards, does not adequately support mobile users, and is inconsistent with the brand identity refresh completed in 2025.

The new website will be built on a modern technology stack (Next.js, Sanity CMS, Vercel) to deliver fast page loads, an excellent mobile experience, and an easy-to-maintain content management workflow for the FreshFoods marketing team. Upon completion, FreshFoods will have a production website that loads in under 2 seconds, scores 90+ on all Lighthouse categories, is fully consistent with the refreshed brand identity, and allows the marketing team to publish and update content without developer involvement.

---

## 2. Scope Definition

### 2.1 In Scope

1. **Design:** High-fidelity UI design for 14 unique page templates (listed in Section 3) with desktop (1280px+), tablet (768px), and mobile (375px) variants, delivered as Figma files
2. **Design system:** Component library in Figma covering typography, color, spacing, buttons, cards, navigation, forms, and footer -- based on existing FreshFoods brand guidelines
3. **Front-end development:** All 14 page templates built in Next.js 14 with TypeScript, using App Router and Server Components where applicable
4. **CMS integration:** Sanity Studio configured with content models for: blog posts, recipes, team members, product categories, FAQ items, testimonials, and general pages
5. **Contact form:** Form with email notification (via Resend) and HubSpot CRM integration for lead capture
6. **Newsletter signup:** Integration with existing Mailchimp account (embedded form + API confirmation)
7. **SEO implementation:** Meta tags, Open Graph tags, XML sitemap, robots.txt, canonical URLs, structured data (Organization, LocalBusiness, Article, FAQ, Recipe schemas)
8. **Performance optimization:** Image optimization (next/image with WebP/AVIF), font optimization, code splitting, lazy loading, targeting Lighthouse scores of 90+ across Performance, Accessibility, Best Practices, and SEO
9. **Cross-browser testing:** Chrome, Safari, Firefox, Edge -- latest 2 versions on desktop; Chrome and Safari on iOS and Android
10. **Cookie consent:** Integration with Cookiebot (or equivalent) for GDPR-compliant cookie management
11. **Analytics:** Google Analytics 4 and Google Tag Manager setup with core event tracking (page views, form submissions, newsletter signups, CTA clicks)
12. **Deployment:** Production and staging environments on Vercel, connected to the client's GitHub organization
13. **CMS training:** Two 60-minute training sessions (recorded) for the FreshFoods marketing team covering content creation, editing, publishing, and image management in Sanity Studio
14. **Documentation:** Technical handoff document covering architecture overview, environment variables, deployment process, CMS content models, and third-party service accounts

### 2.2 Page Templates

| # | Template | Notes |
|---|----------|-------|
| 1 | Homepage | Hero, value props, featured products, testimonials, blog preview, newsletter CTA |
| 2 | About Us | Company story, values, team grid, sustainability section |
| 3 | How It Works | Step-by-step delivery process, delivery zones map, pricing overview |
| 4 | Products / Categories | Filterable grid of product categories with images and descriptions |
| 5 | Product Category Detail | Category-specific product listing with nutritional highlights |
| 6 | Blog Index | Paginated blog listing with category filters and search |
| 7 | Blog Post | Article layout with author, date, related posts, social sharing |
| 8 | Recipes Index | Filterable recipe grid (by meal type, ingredient, prep time) |
| 9 | Recipe Detail | Recipe page with ingredients, steps, nutrition facts, related recipes |
| 10 | FAQ | Accordion-style FAQ page, organized by category |
| 11 | Contact | Contact form, office address with embedded map, customer service hours |
| 12 | Careers | Open positions listing (manually managed in CMS), company culture section |
| 13 | Legal (Privacy / Imprint) | Standard legal page template, reusable for Privacy Policy, Impressum, AGB |
| 14 | 404 | Custom error page with navigation and search |

### 2.3 Out of Scope

- **E-commerce / online ordering:** The website does not include shopping cart, checkout, payment processing, or order management. FreshFoods' existing ordering system (via their mobile app) remains separate.
- **Mobile application:** No native iOS or Android development. The website is responsive web only.
- **Copywriting and content creation:** Client provides all final page copy, product descriptions, blog articles, and recipe content. Agency provides content guidance, placeholder text, and content structure recommendations.
- **Photography and video production:** Client provides all imagery. Agency will source up to 10 stock images from Unsplash/Pexels if needed for design comps.
- **Ongoing SEO strategy:** No keyword research, link building, or content marketing strategy. Basic technical SEO is in scope (see 2.1 item 7).
- **Email marketing:** Beyond the Mailchimp newsletter signup integration, no email template design, automation flows, or campaign management.
- **Ongoing hosting and maintenance:** Post-warranty hosting, updates, security patches, and content support are available as a separate monthly retainer.
- **Accessibility audit:** The site will follow semantic HTML and ARIA best practices, but a formal WCAG 2.1 AA compliance audit is not included (available as a separate engagement).
- **Multi-language / i18n:** The website will be in German only. English or other language versions can be scoped separately.
- **Third-party software costs:** Sanity CMS plan, Vercel hosting, Cookiebot license, Mailchimp, and HubSpot subscription fees are the client's responsibility.

### 2.4 Assumptions

- FreshFoods will provide finalized brand guidelines (logo, colors, typography, photography style) within 5 business days of project kickoff. The design phase relies on these guidelines; delays will shift the design timeline accordingly.
- FreshFoods will provide all final page copy and imagery by the end of Week 6. Content delivered after this date may delay the development phase.
- FreshFoods' designated point of contact (marketing lead) has authority to approve designs and content without requiring additional internal review committees.
- FreshFoods will provision a GitHub organization repository and Vercel team account for the project. Agency will receive admin access to both.
- The existing HubSpot CRM supports standard API-based contact creation. Custom HubSpot workflow configuration is not included.
- Sanity CMS free tier or Team plan will meet FreshFoods' content volume and user requirements.
- No regulatory or legal review is required for the website content beyond standard German Impressum and Datenschutz requirements.

---

## 3. Deliverables & Acceptance Criteria

| # | Deliverable | Format | Acceptance Criteria | Review Period |
|---|------------|--------|-------------------|---------------|
| D1 | UX wireframes (14 templates) | Figma file | All page templates wireframed; information architecture approved | 5 business days |
| D2 | High-fidelity UI designs (14 templates, 3 breakpoints) | Figma file | Visual designs consistent with brand guidelines; 2 revision rounds | 5 business days |
| D3 | Design system / component library | Figma file | All reusable components documented with usage notes | Reviewed with D2 |
| D4 | Functional staging website | Vercel staging URL | All 14 templates functional; CMS-driven content editable; forms working | 5 business days |
| D5 | SEO implementation | Part of staging site | All meta tags, schemas, sitemap, robots.txt verified via testing tools | Reviewed with D4 |
| D6 | Performance benchmarks | PDF report | Lighthouse scores 90+ (all categories) on 5 representative pages | Reviewed with D4 |
| D7 | Cross-browser QA report | PDF/spreadsheet | All listed browsers tested, issues documented and resolved | Reviewed with D4 |
| D8 | CMS training sessions (2x) | Recorded video + written guide | Marketing team can create, edit, and publish content independently | Delivered in Week 11 |
| D9 | Technical documentation | Markdown in Git repo | Architecture, env vars, deployment, CMS models, service accounts documented | Delivered with D4 |
| D10 | Production deployment | Live URL | Site live on production domain, DNS configured, SSL active, redirects from old URLs working | 3 business days |

**Deemed Accepted Clause:** If the Client does not provide written feedback or approval within the specified review period, the deliverable shall be deemed accepted. Deemed acceptance triggers the associated milestone payment and authorizes the Service Provider to proceed to the next phase.

---

## 4. Milestones & Timeline

| Week | Phase | Activities | Milestone |
|------|-------|-----------|-----------|
| 1 | Discovery | Kickoff meeting, requirements finalization, content audit, technical setup | Kickoff complete; requirements confirmed |
| 2-3 | UX Design | Wireframes for all 14 templates, user flow documentation | **M1:** Wireframes approved (D1) |
| 4-5 | Visual Design | High-fidelity mockups, design system, responsive variants | **M2:** Designs approved (D2, D3) |
| 6-8 | Development (Core) | Next.js build, Sanity CMS setup, content models, page templates | All templates functional on staging |
| 9-10 | Development (Integration) | Forms, analytics, cookie consent, SEO, newsletter, CRM integration | **M3:** Feature-complete staging site (D4-D7) |
| 11 | QA & Training | Cross-browser testing, performance optimization, CMS training sessions | **M4:** QA passed, training delivered (D8) |
| 12 | Launch | Content review, final fixes, DNS migration, production deployment, post-launch monitoring | **M5:** Production site live (D9, D10) |

**Post-launch warranty:** 30 calendar days. Defects in delivered scope corrected at no additional cost.

**Client dependencies by week:**
- Week 1: Brand guidelines, stakeholder availability for kickoff (2 hours)
- Week 3: Wireframe feedback (5 business days)
- Week 5: Design feedback (5 business days)
- Week 6: All final copy and imagery delivered
- Week 10: Staging site QA and feedback (5 business days)
- Week 12: DNS credentials, production deployment approval

---

## 5. Roles & Responsibilities

### Service Provider

| Role | Person | Responsibilities |
|------|--------|-----------------|
| Project Lead | [Name] | Client communication, timeline management, scope oversight |
| UI/UX Designer | [Name] | Wireframes, visual design, design system, CMS training materials |
| Full-Stack Developer | [Name] | Next.js development, Sanity CMS, integrations, deployment, documentation |

- Weekly status email every Monday with progress, blockers, and upcoming milestones
- Responds to client communications within 1 business day
- Weekly 30-minute status call (day/time agreed at kickoff)

### Client (FreshFoods GmbH)

- **Designated point of contact:** [Name, Title] with authority to approve deliverables and make design/content decisions
- Provides feedback within specified review periods (5 business days per deliverable)
- Delivers all content (copy, imagery) per the timeline above
- Provisions required accounts and access (GitHub, Vercel, domain registrar, HubSpot, Mailchimp)
- Attends scheduled meetings and CMS training sessions
- **Client delay clause:** Delays in providing feedback, content, or access beyond the specified periods will extend the project timeline day-for-day.

---

## 6. Investment & Payment Schedule

| Phase | Duration | Investment |
|-------|----------|-----------|
| Discovery & UX Design | Weeks 1-3 | EUR 6,500 |
| Visual Design & Design System | Weeks 4-5 | EUR 7,250 |
| Development (Core + Integration) | Weeks 6-10 | EUR 14,500 |
| QA, Training & Launch | Weeks 11-12 | EUR 5,250 |
| Post-Launch Warranty | 30 days | EUR 1,500 |
| **Total** | **12 weeks + warranty** | **EUR 35,000** |

### Payment Schedule

| Milestone | Trigger | Amount | Timing |
|-----------|---------|--------|--------|
| Project kickoff | SOW signed | EUR 10,500 (30%) | Upon execution |
| Designs approved | M2 accepted or deemed accepted | EUR 8,750 (25%) | End of Week 5 |
| Staging site complete | M3 accepted or deemed accepted | EUR 10,500 (30%) | End of Week 10 |
| Production launch | M5 accepted or deemed accepted | EUR 5,250 (15%) | End of Week 12 |

**Payment terms:** Invoices due within 15 business days of issuance. Late payments accrue interest at 1.5% per month.

### Not Included in Investment

- Sanity CMS subscription (free tier or EUR 99/month Team plan -- client's account)
- Vercel hosting (Pro plan: USD 20/month/member -- client's account)
- Cookiebot license (EUR 9-45/month depending on page volume -- client's account)
- Domain registration/renewal
- Stock photography licensing (if premium stock is needed beyond free sources)

---

## 7. Change Order Process

Any modification to the scope, deliverables, timeline, or pricing defined in this SOW requires a written Change Order signed by both parties before changed work begins.

**Process:**
1. Either party submits a written Change Request via email
2. Service Provider responds within 5 business days with a Change Order proposal (scope, cost, timeline impact)
3. Client approves or rejects within 5 business days
4. No work on the change begins until the Change Order is signed

**Pricing for additional work:** Additional work is quoted on a per-item basis. For reference, the Service Provider's standard rates are: Design EUR 120/hr, Development EUR 140/hr, Project Management EUR 100/hr.

---

## 8. Terms

- **Intellectual property:** All deliverables become the exclusive property of FreshFoods GmbH upon receipt of full payment. Pre-existing frameworks, tools, and open-source components retain their original licenses; FreshFoods receives a perpetual license to use them within the delivered project.
- **Confidentiality:** Both parties will treat all information shared during the engagement as confidential. Confidentiality obligations survive for 2 years after engagement completion.
- **Warranty:** 30 calendar days post-launch. Defects in the delivered scope are corrected at no additional cost. Does not cover issues caused by client modifications, third-party service changes, or content updates.
- **Liability:** Service Provider's total liability is limited to the total fees paid under this SOW. Neither party is liable for indirect or consequential damages.
- **Termination:** Either party may terminate with 30 days written notice. Work completed through termination date is billable. Pre-paid fees for unperformed work are refunded within 30 days.
- **Governing law:** Laws of the Federal Republic of Germany. Disputes resolved through negotiation, then mediation in Berlin.

---

## 9. Signatures

| | Service Provider | Client |
|---|-----------------|--------|
| **Signature** | _________________________ | _________________________ |
| **Name** | [Name] | [Name] |
| **Title** | [Title], [Agency Name] | [Title], FreshFoods GmbH |
| **Date** | _________________________ | _________________________ |

By signing above, both parties agree to the terms of this Scope of Work.
