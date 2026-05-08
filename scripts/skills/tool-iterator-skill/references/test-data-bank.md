# Test Data Bank

Ready-to-use realistic test fixtures. Copy-paste into `kitstack call` commands. Using realistic data catches formatting issues that "test123" misses.

## Contacts / People

```json
{"name": "Sarah Chen", "company": "Acme Corp", "email": "sarah@acme.co", "phone": "+49 30 12345678"}
{"name": "Thomas Müller", "company": "Müller & Partner GmbH", "email": "t.mueller@muellerpartner.de"}
{"name": "Priya Sharma", "company": "TechFlow B.V.", "email": "priya@techflow.nl"}
{"name": "James O'Brien", "company": "O'Brien Consulting", "email": "james@obrien.ie"}
{"name": "Anna-Lena Hoffmann", "company": "Hoffmann Design Studio", "email": "al@hoffmanndesign.de"}
```

Notes: Includes umlauts (Müller), apostrophes (O'Brien), hyphens (Anna-Lena), international formats. These catch encoding and special character issues.

## Deals / Projects

```json
{"name": "Acme Website Redesign", "value": 25000, "stage": "proposal", "expectedCloseDate": "2026-06-15"}
{"name": "Müller GmbH Brand Strategy", "value": 18500, "stage": "negotiation", "expectedCloseDate": "2026-07-01"}
{"name": "TechFlow API Integration", "value": 42000, "stage": "qualified", "expectedCloseDate": "2026-08-30"}
{"name": "O'Brien Q3 Retainer", "value": 9000, "stage": "closed-won", "expectedCloseDate": "2026-09-01"}
```

## Expenses

```json
{"description": "Flight Berlin → Frankfurt", "amount": 189.50, "category": "travel", "date": "2026-04-15"}
{"description": "Adobe Creative Cloud", "amount": 65.49, "category": "software", "date": "2026-04-01"}
{"description": "Client lunch — Müller GmbH", "amount": 47.80, "category": "meals", "date": "2026-04-10"}
{"description": "WeWork day pass", "amount": 29.00, "category": "office", "date": "2026-04-12"}
{"description": "Figma Pro annual", "amount": 144.00, "category": "software", "date": "2026-04-01"}
{"description": "Train München → Berlin", "amount": 89.90, "category": "travel", "date": "2026-04-20"}
```

Notes: Mix of categories, realistic German amounts (with comma decimals in display), special characters in descriptions.

## Activities / Interactions

```json
{"type": "call", "description": "Discovery call — discussed Q3 roadmap and budget. Sarah interested in brand refresh."}
{"type": "email", "description": "Sent proposal v2 with revised timeline. Waiting for feedback by Friday."}
{"type": "meeting", "description": "In-person kickoff at Acme HQ. Agreed on milestones and weekly cadence."}
{"type": "note", "description": "Sarah mentioned they're also evaluating competitor BigDesign. Need to differentiate on speed."}
```

## Tasks / Action Items

```json
{"title": "Draft project brief", "status": "done", "priority": "high", "deadline": "2026-04-20"}
{"title": "Set up staging environment", "status": "in_progress", "priority": "high", "deadline": "2026-04-25"}
{"title": "Design homepage wireframe", "status": "todo", "priority": "medium", "deadline": "2026-05-01"}
{"title": "Review SEO audit results", "status": "todo", "priority": "low", "deadline": "2026-05-10"}
```

## Content / Posts

```json
{"title": "Why Most Pricing Pages Are Wrong", "type": "linkedin", "status": "draft"}
{"title": "How We Rebuilt Our Client Onboarding in 2 Weeks", "type": "blog", "status": "published", "publishedDate": "2026-04-15"}
{"title": "Q2 Market Update: DACH SaaS Trends", "type": "newsletter", "status": "scheduled", "scheduledDate": "2026-05-01"}
```

## Decisions

```json
{"title": "Switch from hourly to project pricing", "context": "Lost 2 deals because hourly feels expensive. Project pricing lets us capture efficiency gains.", "reasoning": "Project pricing aligns incentives — we're rewarded for being fast, client knows the total upfront."}
{"title": "Hire a junior designer vs. freelancer", "context": "Design capacity is bottleneck. Team is overloaded.", "reasoning": "Junior hire: €45K/yr, learning curve 3 months. Freelancer: €80/hr but immediate capacity. Going with freelancer for Q2, reassess in Q3."}
```

## Edge Case Data

### Empty / minimal
```json
{"name": ""}
{"name": "A"}
{}
```

### Very long text
```json
{"description": "This is a very long expense description that tests how the tool handles text that exceeds typical lengths. It includes multiple sentences and goes on for quite a while to test truncation, wrapping, and display formatting in both the tool response and any views that render this data. Some tools may need to truncate this for the LLM response while storing the full text in the database."}
```

### Special characters
```json
{"name": "Ströer SE & Co. KGaA"}
{"name": "Société Générale"}
{"description": "50% off — end-of-year \"clearance\" sale"}
{"name": "Test <script>alert('xss')</script>"}
```

### Numeric edge cases
```json
{"amount": 0}
{"amount": 0.01}
{"amount": 999999.99}
{"amount": -50}
```

### Date edge cases
```json
{"date": "2026-01-01"}
{"date": "2026-12-31"}
{"date": "2025-06-15"}
{"date": "2030-01-01"}
{"date": "not-a-date"}
```
