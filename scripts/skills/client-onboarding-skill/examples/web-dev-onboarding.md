# Example: Web Development Client Onboarding

## User Input

> I just signed a new client for a website redesign. They're a boutique law firm in Munich, 12 lawyers, current site is WordPress and looks like it was built in 2015. Budget is €18,000, timeline is 8 weeks. I'm a solo freelance developer, I use Notion for project management and Slack for comms. They want a modern site with a blog, team page, practice area pages, and a contact form. CMS should be easy for their office manager to update.

---

## Generated Output

# Client Onboarding Checklist
**Client:** Boutique Law Firm (Munich)
**Project:** Website Redesign — Modern, CMS-managed site
**Budget:** €18,000 | **Timeline:** 8 weeks
**Your Role:** Solo freelance developer

---

## Phase 1: Welcome (Day 0-1)

**Goal:** Confirm the engagement, collect essentials, schedule kickoff.

- [ ] **Send welcome email within 2 hours of contract signing** (you)
  - Reference the website redesign specifically, express enthusiasm for the project
  - Include what-to-expect timeline for the next 8 weeks
  - Attach intake questionnaire link
  - Include Calendly link for kickoff scheduling
- [ ] **Send intake questionnaire** (you) — include these questions:
  - What are the top 3 goals for the new website? (e.g., attract new clients, establish credibility, recruit talent)
  - Who is your target audience? (individuals, corporate clients, specific practice areas)
  - List 2-3 law firm websites you admire and what you like about them
  - Do you have brand guidelines, logo files, or a preferred color palette?
  - Who will manage the website after launch? What's their technical comfort level?
  - Do you need any integrations? (appointment booking, client portal, newsletter, live chat)
  - Are there any compliance requirements for your firm's web presence?
- [ ] **Request access credentials** (you)
  - Current WordPress admin login
  - Domain registrar login (or confirm who manages DNS)
  - Hosting account access
  - Google Analytics / Search Console access
  - Any existing email marketing tool credentials
- [ ] **Send first invoice — €9,000 (50% upfront)** (you)
- [ ] **Schedule kickoff meeting for Day 3-4** (you → client picks a slot)

---

## Phase 2: Setup (Day 1-3)

**Goal:** Prepare internally so the kickoff is productive and professional.

- [ ] **Create Notion project workspace** (you)
  - Board with phases: Discovery → Design → Development → Testing → Launch
  - Pre-populate tasks from this checklist
  - Create a "Client Shared" section for documents and feedback
- [ ] **Create Slack channel: #lawfirm-redesign** (you)
  - Invite the client's main contact (office manager or managing partner)
  - Pin a message with project overview and key links
- [ ] **Review intake questionnaire responses** (you)
  - Note any gaps or follow-up questions for the kickoff
  - Research the competitor sites they referenced
- [ ] **Audit existing WordPress site** (you)
  - Screenshot current pages for before/after comparison
  - Catalog existing content (pages, blog posts, images)
  - Check current SEO metrics (rankings, backlinks, traffic)
  - Identify content that can be migrated vs. rewritten
  - Note any broken functionality or technical debt
- [ ] **Draft sitemap proposal** (you)
  - Home, About, Practice Areas (6-8 sub-pages), Team (12 bios), Blog, Contact
  - Estimate total pages: ~25-30
- [ ] **Prepare kickoff agenda** (you) — send to client 24 hours before
- [ ] **Set up local development environment** (you)
  - Decide on tech stack: headless CMS (Sanity/Strapi) + Next.js, or WordPress theme rebuild
  - Set up Git repository

---

## Phase 3: Kickoff (Day 3-5)

**Goal:** Align on design direction, content plan, and timeline. Build rapport.

- [ ] **Confirm kickoff attendees** (you → client)
  - Ideal: managing partner + office manager (the content updater)
- [ ] **Run kickoff meeting (45-60 min)** (you facilitates)
  - Introductions and roles (5 min)
  - Their goals for the new website — listen, don't present (10 min)
  - Walk through proposed sitemap and get corrections (10 min)
  - Discuss design direction: show 2-3 reference sites, ask reactions (10 min)
  - Content plan: who writes what? Do they need a copywriter? (5 min)
  - CMS training: explain how the new system will work for the office manager (5 min)
  - Timeline walkthrough and client dependencies (5 min)
  - Questions and next steps (5 min)
- [ ] **Send kickoff summary within 24 hours** (you)
  - Confirmed sitemap
  - Design direction agreed
  - Content responsibilities assigned
  - Updated 8-week timeline with milestones
  - Action items with owners and deadlines
- [ ] **Share Notion project board with client** (you)
- [ ] **Create stakeholder contact sheet** (you)
  - Managing partner: strategic decisions, final approval
  - Office manager: day-to-day contact, content updates, CMS user
  - Note: confirm who has final sign-off on design

---

## Phase 4: First Delivery (Day 5-14)

**Goal:** Deliver homepage design mockup and get alignment before building anything.

- [ ] **Design homepage mockup in Figma** (you) — deliver by Day 8-9
  - Desktop and mobile versions
  - Show real content where possible (firm name, real practice areas)
  - Include 2 style directions if design direction wasn't fully resolved at kickoff
- [ ] **Present mockup with context email** (you)
  - Explain design rationale: "I chose a navy + gold palette because it conveys authority and sophistication, which aligns with your firm's positioning"
  - Link to Figma with commenting enabled
  - Ask specific questions:
    1. "Does this feel like your firm? Too modern, too traditional, or just right?"
    2. "Are the practice area categories correct and complete?"
    3. "Is there any content or element you expected to see on the homepage that's missing?"
  - Request feedback within 3 business days
- [ ] **Follow up if no feedback by Day 12** (you → Slack message)
  - "Hi [name], just checking if you've had a chance to review the homepage mockup. Happy to jump on a quick call if it's easier to talk through feedback live."
- [ ] **Process feedback and deliver revision by Day 14** (you)
- [ ] **Upon homepage approval, begin inner page designs + development** (you)

---

## Phase 5: Check-In (Day 14-21)

**Goal:** Confirm the process is working before you're deep in development.

- [ ] **Schedule 15-minute check-in call around Day 18-20** (you)
- [ ] **Ask process questions** (you)
  - "How is the communication working? Is Slack + email the right mix?"
  - "Is the pace of the project feeling right?"
  - "Is there anything about how we're working together that you'd change?"
  - "Any concerns about the timeline or upcoming milestones?"
- [ ] **Adjust process based on feedback** (you)
  - Document any changes in the Notion project space
  - Confirm changes via Slack: "Based on your feedback, I'll now [change]. Thanks for flagging that."
- [ ] **Confirm remaining timeline** (you)
  - Week 3-4: Inner page designs + development sprint
  - Week 5-6: Content migration + blog setup
  - Week 6-7: Testing, revisions, CMS training
  - Week 8: Launch prep, DNS switch, post-launch monitoring

---

## Key Dates Summary

| Milestone | Target Date | Owner |
|-----------|------------|-------|
| Welcome email + intake sent | Day 0 | You |
| Intake completed | Day 2 | Client |
| Kickoff meeting | Day 3-4 | Both |
| Homepage mockup delivered | Day 8-9 | You |
| Homepage approved | Day 12-14 | Client |
| Process check-in | Day 18-20 | Both |
| Inner pages designed | Day 21 | You |
| Development complete | Day 35 | You |
| Content migration done | Day 42 | You + Client |
| CMS training session | Day 49 | You + Client |
| Launch | Day 56 | You |

---

> **Note:** This checklist assumes the client is responsive and provides content on time. Add 1-2 buffer days per milestone where client approval is required. If content is a blocker, discuss hiring a legal copywriter at the kickoff — law firm websites need precise language.
