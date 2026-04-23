# Example: SaaS Founder Outreach — 3-Email Sequence

## User Input

> I built a developer tool that automates database migration testing. We're pre-revenue, just launched, and I want to reach VPs of Engineering at mid-stage startups (50-200 employees) who are likely dealing with painful database migrations. Goal: get them to try the free tier. Keep it very casual — I'm a technical founder, not a sales person.

---

## Generated Sequence

# Cold Email Sequence: MigrateTest → VPs of Engineering

**Target:** VP Engineering / Head of Engineering at startups with 50-200 employees, likely running PostgreSQL or MySQL in production
**Goal:** Get them to try the free tier
**Sequence:** 3 emails over 10 days

---

## Email 1: The Opener
**Send:** Day 0 (Tuesday, 10:00 AM recipient's timezone)
**Subject:** database migrations at [company]

Hey [first_name],

I'm building MigrateTest — an open-core tool that catches migration issues before they hit production. It runs your migration against a snapshot of your prod schema + sample data, flags breaking changes, estimates lock times, and simulates rollback.

Built it because I personally caused a 3-hour outage at my last company with a migration that looked fine in staging but locked a 200M-row table in prod.

If your team does any non-trivial schema changes, it might save some Friday night pages. Free tier covers up to 50 migrations/month.

Worth a look? [link]

[Your name]
Founder, MigrateTest

---

## Email 2: The Value Add
**Send:** Day 4 (Saturday, 9:00 AM — engineers check email on weekends)
**Subject:** the migration that always breaks

Hey [first_name],

Didn't mean to spam your inbox — just one more thought.

I analyzed 2,000+ migration failures from our beta users. The most common production-breaking pattern isn't what most people expect. It's not missing indexes or wrong data types. It's `ALTER TABLE` on large tables without estimating lock duration.

Wrote up the top 5 patterns here: [blog post link]. Useful even without MigrateTest — it's a 3-minute read.

[Your name]

---

## Email 3: The Breakup
**Send:** Day 10 (Tuesday, 10:00 AM)
**Subject:** not the right time?

Hey [first_name],

Totally get it if database migration testing isn't top of mind. Probably means your migrations are going smoothly — which is great.

If it ever becomes a pain point (usually happens around the 100th table or the 3rd "oh shit" production incident), MigrateTest will be here: [link]

No more emails from me. Hope [company] is crushing it.

[Your name]

---

## Personalization Notes

- **[company]** — Prospect's company name
- **[first_name]** — First name
- **Email 1:** If you can find their tech stack (from job postings, StackShare, or GitHub repos), mention the specific database: "If your team runs Postgres migrations..." is stronger than the generic version
- **Email 2:** The blog post should be a real, useful resource. If you don't have one, write it — it's a one-time investment that makes every Email 2 in your sequence more effective
- **Email 3:** "100th table or 3rd production incident" — adjust these numbers based on the company's likely scale. Check their engineering blog or job postings for hints about database complexity.

## A/B Testing Suggestions

**Email 1 subject line variants:**
- A: `database migrations at [company]` (specific, company-focused)
- B: `the migration that killed my Friday night` (story-driven, relatable for engineers)

**Email 1 CTA variants:**
- A: "Worth a look? [link]" (direct link to product)
- B: "Running into migration headaches?" (interest check without pushing product)

## Sequence Notes

This is a 3-email sequence (shorter than standard) because:
1. The ask is low friction (try a free tool, not buy something)
2. Technical buyers are busy and respect brevity
3. The founder/builder voice works best when it doesn't feel like a sales sequence
4. Email 2 links to genuine educational content, not a pitch — this builds trust for future outreach if they don't convert now
