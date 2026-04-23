import type {
  Contact, Deal, Activity, Proposal,
  Expense, QuarterlySummary,
  Sequence, Email, Prospect,
  Meeting, ActionItem, Decision,
} from "./types";

const contacts: Contact[] = [
  { id: "c1", name: "Anna Müller", company: "Acme GmbH", email: "anna@acme.de", phone: "+49 170 1234567", source: "LinkedIn", notes: "Met at SaaStr EU. Interested in brand strategy.", last_contacted_at: "2026-04-20", created_at: 1713600000 },
  { id: "c2", name: "James Chen", company: "NovaTech", email: "james@novatech.io", phone: null, source: "Referral", notes: null, last_contacted_at: "2026-04-18", created_at: 1713500000 },
  { id: "c3", name: "Sophie Laurent", company: "Berliner Kreativ", email: "sophie@bk.studio", phone: "+49 30 9876543", source: "Conference", notes: "Needs website redesign Q3.", last_contacted_at: "2026-04-10", created_at: 1713400000 },
  { id: "c4", name: "Marcus Weber", company: "FinFlow AG", email: "m.weber@finflow.de", phone: null, source: "Cold outreach", notes: null, last_contacted_at: null, created_at: 1713300000 },
  { id: "c5", name: "Elena Rossi", company: "Scala Consulting", email: "elena@scala.it", phone: "+39 333 4567890", source: "LinkedIn", notes: "Italian market expansion project.", last_contacted_at: "2026-04-22", created_at: 1713200000 },
  { id: "c6", name: "Tom Harris", company: null, email: "tom@freelance.dev", phone: null, source: "GitHub", notes: "Freelance developer. Potential subcontractor.", last_contacted_at: "2026-03-15", created_at: 1713100000 },
];

const deals: Deal[] = [
  { id: "d1", name: "Acme Brand Strategy", contact_id: "c1", value: 18000, currency: "EUR", stage: "negotiation", notes: "Final pricing discussion Friday.", expected_close_date: "2026-05-01", created_at: 1713600000, updated_at: 1713650000 },
  { id: "d2", name: "NovaTech Dashboard", contact_id: "c2", value: 14500, currency: "EUR", stage: "proposal", notes: "Sent proposal v2.", expected_close_date: "2026-05-15", created_at: 1713550000, updated_at: 1713600000 },
  { id: "d3", name: "BK Website Redesign", contact_id: "c3", value: 22000, currency: "EUR", stage: "prospect", notes: null, expected_close_date: "2026-06-01", created_at: 1713500000, updated_at: 1713500000 },
  { id: "d4", name: "FinFlow Consulting", contact_id: "c4", value: 8000, currency: "EUR", stage: "prospect", notes: "Initial discovery call scheduled.", expected_close_date: null, created_at: 1713450000, updated_at: 1713450000 },
  { id: "d5", name: "Scala Market Entry", contact_id: "c5", value: 35000, currency: "EUR", stage: "negotiation", notes: "Negotiating payment terms.", expected_close_date: "2026-05-10", created_at: 1713400000, updated_at: 1713620000 },
  { id: "d6", name: "Acme Q1 Retainer", contact_id: "c1", value: 12000, currency: "EUR", stage: "won", notes: "Signed and invoiced.", expected_close_date: "2026-03-01", created_at: 1712000000, updated_at: 1712500000 },
  { id: "d7", name: "NovaTech SEO Audit", contact_id: "c2", value: 4500, currency: "EUR", stage: "won", notes: null, expected_close_date: "2026-03-15", created_at: 1711900000, updated_at: 1712200000 },
  { id: "d8", name: "Harris Dev Sprint", contact_id: "c6", value: 6000, currency: "EUR", stage: "lost", notes: "Budget cut. Revisit in Q3.", expected_close_date: "2026-04-01", created_at: 1711800000, updated_at: 1712100000 },
];

const activities: Activity[] = [
  { id: "a1", contact_id: "c1", deal_id: "d1", type: "meeting", description: "Scope review meeting — aligned on 3-phase approach", created_at: 1713650000 },
  { id: "a2", contact_id: "c1", deal_id: "d1", type: "email", description: "Sent revised pricing with volume discount", created_at: 1713640000 },
  { id: "a3", contact_id: "c2", deal_id: "d2", type: "email", description: "Sent proposal v2 with updated timeline", created_at: 1713600000 },
  { id: "a4", contact_id: "c5", deal_id: "d5", type: "call", description: "Discussed payment terms — NET 30 agreed", created_at: 1713620000 },
  { id: "a5", contact_id: "c3", deal_id: null, type: "note", description: "Sophie mentioned they're also looking for a content strategy partner", created_at: 1713500000 },
  { id: "a6", contact_id: "c1", deal_id: "d6", type: "task", description: "Send Q1 retainer invoice", created_at: 1712500000 },
  { id: "a7", contact_id: "c4", deal_id: "d4", type: "call", description: "Initial intro call — warm lead from FinTech meetup", created_at: 1713450000 },
  { id: "a8", contact_id: "c5", deal_id: "d5", type: "meeting", description: "Kickoff prep — reviewed Italian market research", created_at: 1713580000 },
  { id: "a9", contact_id: "c2", deal_id: "d7", type: "email", description: "Delivered SEO audit report", created_at: 1712200000 },
  { id: "a10", contact_id: "c6", deal_id: "d8", type: "email", description: "Follow-up after budget cut — offered Q3 restart", created_at: 1712100000 },
];

const proposals: Proposal[] = [
  {
    id: "p1",
    deal_id: "d2",
    version: 2,
    status: "sent",
    created_at: 1713600000,
    content: `# Dashboard Rebuild Proposal

## Executive Summary
We propose a complete rebuild of NovaTech's analytics dashboard, delivering a modern, performant interface that surfaces key metrics in real time.

## Scope of Work

### Phase 1: Discovery & Design (Weeks 1-2)
- Stakeholder interviews (3 sessions)
- Current dashboard audit
- Wireframes + interactive prototype

### Phase 2: Development (Weeks 3-6)
- React frontend with real-time data
- API integration layer
- Role-based access control

### Phase 3: Testing & Launch (Weeks 7-8)
- UAT with core team
- Performance optimization
- Deployment + monitoring setup

## Investment

| Phase | Deliverable | Fee |
|-------|-----------|-----|
| Phase 1 | Discovery & Design | €3,500 |
| Phase 2 | Development | €8,000 |
| Phase 3 | Testing & Launch | €3,000 |
| **Total** | | **€14,500** |

## Payment Terms
50% on signing, 25% at Phase 2 completion, 25% on launch.

## Timeline
8 weeks from kickoff. Target start: May 5, 2026.`,
  },
];

// --- Expense Kit ---

const expenses: Expense[] = [
  { id: "e1", date: "2026-04-01", description: "Büromaterial Schreibwaren Mueller", gross: 47.60, net: 40.00, vat_rate: 19, category: "Bürobedarf", skr03: "4930", receipt_attached: true, confirmed: true },
  { id: "e2", date: "2026-04-03", description: "Adobe Creative Cloud Monatsabo", gross: 65.45, net: 55.00, vat_rate: 19, category: "Software", skr03: "4964", receipt_attached: true, confirmed: true },
  { id: "e3", date: "2026-04-05", description: "Deutsche Bahn Fahrkarte Berlin-München", gross: 119.90, net: 112.99, vat_rate: 7, category: "Reisekosten", skr03: "4660", receipt_attached: true, confirmed: true },
  { id: "e4", date: "2026-04-08", description: "Geschäftsessen Kunde Acme GmbH", gross: 89.50, net: 75.21, vat_rate: 19, category: "Bewirtung", skr03: "4650", receipt_attached: true, confirmed: false },
  { id: "e5", date: "2026-04-10", description: "Fachliteratur Steuerlehre 2026", gross: 49.90, net: 46.64, vat_rate: 7, category: "Fachliteratur", skr03: "4940", receipt_attached: false, confirmed: false },
  { id: "e6", date: "2026-04-12", description: "Hetzner Cloud Server April", gross: 23.80, net: 20.00, vat_rate: 19, category: "Server/Hosting", skr03: "4964", receipt_attached: true, confirmed: true },
  { id: "e7", date: "2026-04-14", description: "Steuerberater Honorar Q1 2026", gross: 595.00, net: 500.00, vat_rate: 19, category: "Steuerberatung", skr03: "4955", receipt_attached: false, confirmed: false },
  { id: "e8", date: "2026-04-16", description: "DHL Paketversand Muster an Kunden", gross: 6.90, net: 5.80, vat_rate: 19, category: "Porto", skr03: "4910", receipt_attached: true, confirmed: true },
  { id: "e9", date: "2026-04-18", description: "Telekom Mobilfunkvertrag April", gross: 39.99, net: 33.61, vat_rate: 19, category: "Telekommunikation", skr03: "4920", receipt_attached: true, confirmed: true },
  { id: "e10", date: "2026-04-20", description: "DATEV Lizenzgebühr Monat April", gross: 0.00, net: 0.00, vat_rate: 0, category: "Software", skr03: "4964", receipt_attached: true, confirmed: true },
];

const quarterly_summaries: QuarterlySummary[] = [
  {
    id: "qs1",
    quarter: "Q2",
    year: 2026,
    total_gross: 1038.04,
    total_net: 889.25,
    total_vat: 148.79,
    category_breakdown: [
      { category: "Software", skr03: "4964", gross: 89.25, net: 75.00 },
      { category: "Bürobedarf", skr03: "4930", gross: 47.60, net: 40.00 },
      { category: "Reisekosten", skr03: "4660", gross: 119.90, net: 112.99 },
      { category: "Bewirtung", skr03: "4650", gross: 89.50, net: 75.21 },
      { category: "Fachliteratur", skr03: "4940", gross: 49.90, net: 46.64 },
      { category: "Steuerberatung", skr03: "4955", gross: 595.00, net: 500.00 },
      { category: "Porto", skr03: "4910", gross: 6.90, net: 5.80 },
      { category: "Telekommunikation", skr03: "4920", gross: 39.99, net: 33.61 },
    ],
    monthly_breakdown: [
      { month: "April", gross: 1038.04, net: 889.25, vat: 148.79 },
      { month: "May", gross: 0, net: 0, vat: 0 },
      { month: "June", gross: 0, net: 0, vat: 0 },
    ],
  },
];

// --- Outreach Kit ---

const emails: Email[] = [
  { id: "em1", sequence_id: "seq1", position: 1, day_offset: 0, subject: "Quick question about {company}'s growth plans", body: "Hi {firstName},\n\nI noticed {company} recently expanded into the European market. We've helped similar companies streamline their brand strategy for EU audiences.\n\nWould you be open to a 15-minute chat this week?\n\nBest,\nKitStack" },
  { id: "em2", sequence_id: "seq1", position: 2, day_offset: 3, subject: "Re: Quick question about {company}'s growth plans", body: "Hi {firstName},\n\nJust circling back on my note from earlier this week. I put together a brief case study from a similar project we did with {similarCompany} — happy to share if useful.\n\nBest,\nKitStack" },
  { id: "em3", sequence_id: "seq1", position: 3, day_offset: 7, subject: "One last thought, {firstName}", body: "Hi {firstName},\n\nI know your inbox is busy, so I'll keep this short. We're running a free brand audit for select companies this quarter. No strings attached.\n\nInterested?\n\nBest,\nKitStack" },
  { id: "em4", sequence_id: "seq2", position: 1, day_offset: 0, subject: "Loved your talk at {eventName}", body: "Hi {firstName},\n\nI caught your session at {eventName} last week — your point about {talkTopic} really resonated. We're working on something in that space and I'd love to get your perspective.\n\nCoffee next week?\n\nBest,\nKitStack" },
  { id: "em5", sequence_id: "seq2", position: 2, day_offset: 4, subject: "Following up from {eventName}", body: "Hi {firstName},\n\nJust a quick follow-up. I've attached a one-pager on how we approach {talkTopic} — might be relevant given what you shared at {eventName}.\n\nLet me know if it sparks any ideas.\n\nBest,\nKitStack" },
  { id: "em6", sequence_id: "seq2", position: 3, day_offset: 8, subject: "Last note, {firstName}", body: "Hi {firstName},\n\nDon't want to overstay my welcome in your inbox. If the timing isn't right, totally understand.\n\nWould it be helpful if I reached out again in Q3 instead?\n\nBest,\nKitStack" },
  { id: "em7", sequence_id: "seq2", position: 4, day_offset: 14, subject: "Checking in, {firstName}", body: "Hi {firstName},\n\nIt's been a couple of weeks since {eventName}. Just wanted to leave the door open — if you ever want to chat about {talkTopic}, I'm here.\n\nAll the best,\nKitStack" },
];

const sequences: Sequence[] = [
  { id: "seq1", name: "EU Expansion Outreach", status: "active", prospect_count: 24, emails: emails.filter((e) => e.sequence_id === "seq1"), created_at: "2026-04-01" },
  { id: "seq2", name: "Conference Follow-up", status: "draft", prospect_count: 12, emails: emails.filter((e) => e.sequence_id === "seq2"), created_at: "2026-04-10" },
];

const prospects: Prospect[] = [
  { id: "pr1", name: "Lena Bauer", company: "Streamline AG", email: "l.bauer@streamline.de", linkedin: "https://linkedin.com/in/lenabauer", status: "new", personalization_hooks: ["Recently raised Series B", "Expanding to France"], sequence_id: "seq1" },
  { id: "pr2", name: "Marco Bellini", company: "Piazza Digital", email: "marco@piazzadigital.it", linkedin: "https://linkedin.com/in/marcobellini", status: "contacted", personalization_hooks: ["Speaker at WebSummit", "Former Spotify"], sequence_id: "seq1" },
  { id: "pr3", name: "Clara Jensen", company: "Nordic Brand Co", email: "clara@nordicbrand.dk", linkedin: null, status: "replied", personalization_hooks: ["Mentioned need for rebrand on LinkedIn"], sequence_id: "seq1" },
  { id: "pr4", name: "Felix Richter", company: "CodeCraft GmbH", email: "felix@codecraft.io", linkedin: "https://linkedin.com/in/felixrichter", status: "converted", personalization_hooks: ["Met at FinTech meetup", "Uses competing product", "Team of 30+"], sequence_id: "seq2" },
  { id: "pr5", name: "Ana Pereira", company: "Luz Studios", email: "ana@luzstudios.pt", linkedin: "https://linkedin.com/in/anapereira", status: "new", personalization_hooks: ["Award-winning design agency"], sequence_id: null },
  { id: "pr6", name: "David Kim", company: "HanTech Solutions", email: "d.kim@hantech.kr", linkedin: "https://linkedin.com/in/davidkim", status: "contacted", personalization_hooks: ["Expanding EU operations", "Hiring brand manager"], sequence_id: "seq2" },
];

// --- Meeting Kit ---

const decisions: Decision[] = [
  { id: "dec1", meeting_id: "mt1", description: "Go with 3-phase rollout instead of big-bang launch" },
  { id: "dec2", meeting_id: "mt1", description: "Budget capped at EUR 22,000 including contingency" },
  { id: "dec3", meeting_id: "mt1", description: "Sophie to be primary point of contact" },
  { id: "dec4", meeting_id: "mt2", description: "Use React + Tailwind for the dashboard rebuild" },
  { id: "dec5", meeting_id: "mt2", description: "Weekly sync every Tuesday at 10:00" },
  { id: "dec6", meeting_id: "mt3", description: "Postpone Italian market entry to June" },
  { id: "dec7", meeting_id: "mt3", description: "Split payment into 3 milestones" },
];

const action_items: ActionItem[] = [
  { id: "ai1", meeting_id: "mt1", description: "Draft wireframes for homepage redesign", owner: "You", deadline: "2026-04-28", status: "open", meeting_title: "BK Website Kickoff" },
  { id: "ai2", meeting_id: "mt1", description: "Share brand guidelines document", owner: "Sophie Laurent", deadline: "2026-04-25", status: "done", meeting_title: "BK Website Kickoff" },
  { id: "ai3", meeting_id: "mt1", description: "Set up staging environment", owner: "You", deadline: "2026-04-30", status: "open", meeting_title: "BK Website Kickoff" },
  { id: "ai4", meeting_id: "mt2", description: "Deliver API specification document", owner: "James Chen", deadline: "2026-04-22", status: "overdue", meeting_title: "NovaTech Dashboard Review" },
  { id: "ai5", meeting_id: "mt2", description: "Create component library in Figma", owner: "You", deadline: "2026-05-01", status: "open", meeting_title: "NovaTech Dashboard Review" },
  { id: "ai6", meeting_id: "mt2", description: "Schedule UAT session with stakeholders", owner: "James Chen", deadline: "2026-05-10", status: "open", meeting_title: "NovaTech Dashboard Review" },
  { id: "ai7", meeting_id: "mt3", description: "Research Italian market regulations", owner: "Elena Rossi", deadline: "2026-04-20", status: "overdue", meeting_title: "Scala Market Entry Planning" },
  { id: "ai8", meeting_id: "mt3", description: "Prepare milestone-based proposal", owner: "You", deadline: "2026-04-29", status: "open", meeting_title: "Scala Market Entry Planning" },
];

const meetings: Meeting[] = [
  {
    id: "mt1",
    title: "BK Website Kickoff",
    date: "2026-04-21",
    attendees: ["You", "Sophie Laurent", "Tom Harris"],
    decisions: decisions.filter((d) => d.meeting_id === "mt1"),
    action_items: action_items.filter((a) => a.meeting_id === "mt1"),
    open_questions: [
      "Which CMS to use — WordPress or headless?",
      "Do we need multi-language support from day one?",
    ],
    summary: "Kicked off the BK Website Redesign project. Agreed on phased approach, budget, and primary contact.",
  },
  {
    id: "mt2",
    title: "NovaTech Dashboard Review",
    date: "2026-04-18",
    attendees: ["You", "James Chen"],
    decisions: decisions.filter((d) => d.meeting_id === "mt2"),
    action_items: action_items.filter((a) => a.meeting_id === "mt2"),
    open_questions: [
      "Real-time vs. polling for data updates?",
      "SSO integration needed for Phase 1?",
    ],
    summary: "Reviewed dashboard proposal v2 and aligned on tech stack. James to provide API specs.",
  },
  {
    id: "mt3",
    title: "Scala Market Entry Planning",
    date: "2026-04-15",
    attendees: ["You", "Elena Rossi", "Anna Muller"],
    decisions: decisions.filter((d) => d.meeting_id === "mt3"),
    action_items: action_items.filter((a) => a.meeting_id === "mt3"),
    open_questions: [
      "Partnership model — white-label or co-branded?",
      "Legal entity needed in Italy?",
      "Timeline impact if regulations change?",
    ],
    summary: "Discussed Italian market entry. Decided to push timeline to June and use milestone-based billing.",
  },
];

export const MOCK_DATA: Record<string, unknown[]> = {
  contacts,
  deals,
  activities,
  proposals,
  expenses,
  quarterly_summaries,
  sequences,
  emails,
  prospects,
  meetings,
  action_items,
  decisions,
};
