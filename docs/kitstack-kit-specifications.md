# KitStack Kit Specifications

## Document Purpose

This document specifies the five kits that ship with KitStack at launch. Each specification is implementation-ready: schema, tools, views, instructions, and the strategic rationale behind every design decision.

## Design Constraints (All Kits)

Every kit operates within the same boundary conditions:

- **No network access.** Kit Lambdas run in a VPC with no NAT gateway. The user is the only data source. Every piece of information enters through conversation.
- **No background execution.** Kits run only when the LLM calls them. No scheduled tasks, no reminders, no triggers.
- **Single-user, single-session.** No collaboration, no shared state between users.
- **SQLite per user.** Each user gets an isolated database. Migrations run automatically on first use.
- **View rendering via MCP Apps.** Interactive React components rendered in sandboxed iframes inside the chat.
- **Progressive discovery.** The LLM enters a kit via `kit(id)`, inspects actions via `kit(id, cmd)`, and executes via `kit(id, cmd, params)`.
- **Runtime limits.** 10s timeout, 128MB memory, 5 concurrent executions per kit. Kill switch triggers at 300 invocations/min.

## Schema Conventions

All tables follow these conventions:

- `id` is always `TEXT PRIMARY KEY` using a prefixed nanoid (e.g., `con_abc123`, `exp_def456`). Prefixes make cross-table debugging trivial.
- `created_at` and `updated_at` are `TEXT` columns storing ISO 8601 timestamps. The LLM generates these at call time.
- Enum-like values are stored as `TEXT` with validation in the tool handler, not as database constraints. This keeps migrations simple and lets the LLM reason about valid values from the instructions.
- Soft deletes via `archived_at TEXT DEFAULT NULL`. Archived records are excluded from default queries but recoverable. Use `archive` as the tool name, not `delete`.
- All monetary values stored as `INTEGER` in cents. The LLM formats for display. This avoids floating-point issues entirely.

## Tool Response Conventions

All write tools (create, update, delete) **must** use composable result fragments to return entity IDs for workflow chaining:

```typescript
// Write tools — always return IDs
return kit.result(
  kit.created(id, "contact", `Contact "${args.first_name} ${args.last_name}" added.`)
);

// Multiple mutations in one tool
return kit.result([
  kit.created(contactId, "contact", `Contact "${name}" added.`),
  kit.created(companyId, "company", `Company "${company}" created.`),
]);

// Read tools — use kit.text() for markdown responses
return kit.text(markdownTable);
```

The LLM needs entity IDs to chain multi-step workflows. Without them, `add_contact` → `add_deal` → `log_interaction` breaks because the deal can't reference the contact.

Note: IDs should appear in the structured response header (`✓ created contact con_abc123`) but the LLM instructions should say "never show internal IDs to the user" — meaning the LLM doesn't display them conversationally, but uses them internally for chaining.

## Triggers

Every kit must define `triggers` — lowercase keywords that help LLMs match user requests to the kit via deferred tool search. These are included in the `defineKit()` call and appear in the dynamic tool description:

```typescript
export default defineKit({
  id: "crm",
  triggers: ["contact", "company", "deal", "pipeline", "follow-up", "crm", "relationship"],
  // ...
});
```

---

## Kit 1: CRM

**Triggers:** `contact, company, deal, pipeline, follow-up, crm, relationship, sales, proposal`

### Positioning

The universal entry point. Every freelancer, consultant, and solopreneur tracks relationships somewhere — usually in their head, a spreadsheet, or scattered notes. The CRM kit replaces all of that with a structured, queryable relationship database that the LLM can reason across.

The value compounds fast. By week three, the user has a relationship history they can query: "Who haven't I followed up with in two weeks?", "Show me everyone I met through the Berlin PropTech event", "Which deals are stalling?"

### Schema

```sql
-- Migration 001: initial schema

CREATE TABLE companies (
  id TEXT PRIMARY KEY,           -- com_xxxxx
  name TEXT NOT NULL,
  domain TEXT,
  industry TEXT,
  size TEXT,                     -- solo, 2-10, 11-50, 51-200, 201-1000, 1000+
  notes TEXT,
  tags TEXT,                     -- comma-separated
  archived_at TEXT DEFAULT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE contacts (
  id TEXT PRIMARY KEY,           -- con_xxxxx
  company_id TEXT REFERENCES companies(id),
  first_name TEXT NOT NULL,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  role TEXT,                     -- job title / role description
  relationship TEXT DEFAULT 'neutral',  -- warm, neutral, cold
  source TEXT,                   -- how we met: event, referral, inbound, outbound, linkedin
  notes TEXT,
  tags TEXT,                     -- comma-separated
  archived_at TEXT DEFAULT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE interactions (
  id TEXT PRIMARY KEY,           -- int_xxxxx
  contact_id TEXT NOT NULL REFERENCES contacts(id),
  type TEXT NOT NULL,            -- call, email, meeting, coffee, linkedin, event, note
  summary TEXT NOT NULL,
  sentiment TEXT,                -- positive, neutral, negative
  follow_up TEXT,                -- what to do next, if anything
  follow_up_by TEXT,             -- ISO date for follow-up deadline
  occurred_at TEXT NOT NULL,     -- when the interaction happened
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE deals (
  id TEXT PRIMARY KEY,           -- deal_xxxxx
  contact_id TEXT REFERENCES contacts(id),
  company_id TEXT REFERENCES companies(id),
  title TEXT NOT NULL,
  value_cents INTEGER,           -- deal value in cents
  currency TEXT DEFAULT 'EUR',
  stage TEXT DEFAULT 'lead',     -- lead, contacted, proposal, negotiation, won, lost
  probability INTEGER,           -- 0-100
  expected_close TEXT,           -- ISO date
  lost_reason TEXT,
  notes TEXT,
  archived_at TEXT DEFAULT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_contacts_company ON contacts(company_id);
CREATE INDEX idx_interactions_contact ON interactions(contact_id);
CREATE INDEX idx_deals_stage ON deals(stage);
CREATE INDEX idx_deals_contact ON deals(contact_id);
```

### Tools

| Action | Description | Key Parameters |
|--------|-------------|----------------|
| `add_contact` | Add a new contact, optionally with company | first_name, last_name, company (name or id), role, email, source, notes |
| `add_company` | Add a new company | name, domain, industry, size |
| `log_interaction` | Log a conversation, meeting, or touchpoint | contact (name or id), type, summary, follow_up, follow_up_by |
| `add_deal` | Create a deal in the pipeline | title, contact, company, value, currency, stage, expected_close |
| `update_deal` | Move a deal through stages or update details | deal (id or title), stage, value, probability, lost_reason |
| `update_contact` | Update contact details or relationship warmth | contact (name or id), any updatable field |
| `search` | Full-text search across contacts, companies, interactions | query (free text) |
| `list_contacts` | List contacts with optional filters | company, relationship, tag, source, limit |
| `list_deals` | List deals with optional filters | stage, contact, company, min_value, max_value |
| `follow_ups` | Show overdue and upcoming follow-ups | days_ahead (default 7) |
| `pipeline` | Show deal pipeline summary with stage counts and values | — |
| `archive` | Soft-delete a contact, company, or deal | entity type, id |

#### Tool Design Notes

**Fuzzy matching on names.** When the user says "log a call with Anna", the tool should search contacts by first_name and last_name using `LIKE` before requiring an exact ID. If multiple matches exist, return them and ask the LLM to disambiguate. This is critical for conversational usability — nobody remembers IDs.

**Implicit company creation.** When adding a contact with a company name that doesn't exist, create the company automatically and link it. Don't force a two-step flow.

**Interaction timestamps.** `occurred_at` defaults to "now" but accepts natural language dates from the LLM ("yesterday", "last Tuesday"). The LLM resolves these to ISO dates before calling the tool.

### Views

**Pipeline View** (default view)
A Kanban-style board showing deals by stage. Each card shows deal title, company, value, and expected close date. Color-coded by probability: green (>70%), yellow (30-70%), red (<30%). Shows total value per stage at the column header.

**Contact List View**
A searchable, sortable table of all contacts. Columns: name, company, role, relationship warmth (color dot), last interaction date, tags. Clicking a contact expands to show their interaction timeline and associated deals.

**Follow-Up View**
A focused list of overdue follow-ups (red) and upcoming follow-ups (sorted by date). Each item shows the contact name, the follow-up action, the source interaction summary, and a "Mark Done" button that logs a completion interaction.

### Instructions

```
You are a personal CRM assistant. Your job is to help the user build and maintain their professional relationship network.

When the user mentions meeting someone, having a call, sending an email, or any professional interaction, proactively suggest logging it. Don't wait for explicit instructions — if the user says "I just had coffee with Anna from Deloitte," that's a signal to log the interaction.

When logging interactions, always ask about follow-ups: "Anything you want to follow up on?" This is the behavior that makes the CRM valuable over time.

Default relationship warmth: set to "warm" after any positive interaction, "cold" if no interaction logged in 30+ days. Update automatically when showing contacts.

Deal stages flow in one direction: lead → contacted → proposal → negotiation → won/lost. When a user mentions sending a proposal, suggest moving the deal to "proposal" stage. When they mention pricing discussions, suggest "negotiation."

When the user asks about their pipeline, show the pipeline view. When they ask about follow-ups or "what should I do today," show the follow-up view.

Never show internal IDs to the user. Always reference contacts and companies by name.
```

---

## Kit 2: Expenses

**Triggers:** `expense, income, vat, tax, receipt, budget, steuerberater, bookkeeping, invoice, skr03`

### Positioning

Money tracking is the second-most-common Notion template category and the highest-friction pain point for freelancers. The kit eliminates the spreadsheet: "Lunch with client, €47, business meal" gets categorized, VAT-tagged, and stored. The DACH angle is strong — Kleinunternehmerregelung vs. standard VAT, SKR03 category mapping — giving KitStack a regulatory moat that generic tools can't replicate.

### Schema

```sql
-- Migration 001: initial schema

CREATE TABLE expenses (
  id TEXT PRIMARY KEY,            -- exp_xxxxx
  amount_cents INTEGER NOT NULL,  -- gross amount in cents
  currency TEXT DEFAULT 'EUR',
  vat_rate INTEGER,               -- VAT percentage (0, 7, 19 for DE; NULL if unknown)
  net_cents INTEGER,              -- net amount, computed by tool
  vat_cents INTEGER,              -- VAT amount, computed by tool
  category TEXT NOT NULL,         -- see categories below
  subcategory TEXT,
  description TEXT NOT NULL,
  vendor TEXT,
  payment_method TEXT,            -- cash, card, transfer, paypal
  is_deductible INTEGER DEFAULT 1, -- 1 = yes, 0 = no
  receipt_note TEXT,              -- user's note about the receipt (no file upload)
  tags TEXT,
  expense_date TEXT NOT NULL,     -- when the expense occurred
  archived_at TEXT DEFAULT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE income (
  id TEXT PRIMARY KEY,            -- inc_xxxxx
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'EUR',
  source TEXT NOT NULL,           -- client name or income source
  description TEXT,
  invoice_ref TEXT,               -- invoice number if applicable
  payment_method TEXT,
  received_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  skr03_account TEXT,             -- SKR03 mapping for German users (e.g., "4600" for advertising)
  parent_category TEXT,
  is_default INTEGER DEFAULT 0
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- Default settings inserted via migration:
-- vat_mode: 'standard' | 'kleinunternehmer'
-- default_currency: 'EUR'
-- fiscal_year_start: '01' (month)

CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_income_date ON income(received_date);
```

#### Default Categories (seeded via migration)

| Category | SKR03 | Description |
|----------|-------|-------------|
| office_supplies | 4930 | Bürobedarf |
| software | 4964 | Software & subscriptions |
| hardware | 0410 | Hardware & equipment |
| travel | 4660 | Reisekosten |
| meals_business | 4650 | Bewirtungskosten |
| meals_personal | 4680 | Not deductible |
| phone_internet | 4920 | Telefon & Internet |
| advertising | 4600 | Werbekosten |
| education | 4945 | Fortbildungskosten |
| insurance | 4360 | Versicherungen |
| rent | 4210 | Miete (incl. home office share) |
| professional_services | 4900 | Rechts- und Beratungskosten |
| transport | 4670 | Fahrtkosten |
| misc | 4900 | Sonstige Kosten |

### Tools

| Action | Description | Key Parameters |
|--------|-------------|----------------|
| `add_expense` | Log an expense | amount, description, category, vendor, date, vat_rate, payment_method |
| `add_income` | Log income received | amount, source, description, invoice_ref, date |
| `list_expenses` | List expenses with filters | period (this_month, last_month, Q1, Q2, etc.), category, min_amount, max_amount |
| `list_income` | List income with filters | period, source |
| `summary` | Financial summary for a period | period (month, quarter, year, custom range) |
| `by_category` | Breakdown of expenses by category | period |
| `vat_report` | VAT summary: total collected, total deductible, net liability | period (quarter, year) |
| `update_expense` | Modify an existing expense | id, any updatable field |
| `archive` | Soft-delete an expense or income entry | entity type, id |
| `set_preference` | Update settings | key, value (e.g., vat_mode = kleinunternehmer) |
| `add_category` | Add a custom expense category | name, skr03_account, parent_category |
| `profit_loss` | Simple P&L: total income - total expenses | period |

#### Tool Design Notes

**Auto-VAT.** When the user provides a gross amount without specifying VAT, the tool applies the default rate (19% for standard, 0% for Kleinunternehmer). The tool computes `net_cents` and `vat_cents` automatically. If the user says "7% VAT" (reduced rate for food, books, etc.), use that instead.

**Natural language dates.** "Yesterday", "last Friday", "March 15" — the LLM resolves these before calling the tool. Default is today.

**Category inference.** The instructions tell the LLM to infer categories from the description when the user doesn't specify one. "AWS bill" → software. "Train to Munich" → travel. "Lunch with client at Vapiano" → meals_business.

**Kleinunternehmer mode.** When `vat_mode = kleinunternehmer`, all VAT fields are set to 0 and the VAT report tool returns a note explaining that no VAT is collected or deducted. This is the single most important DACH-specific feature.

### Views

**Monthly Dashboard** (default view)
Top section: total expenses, total income, profit/loss for current month. Three mini-charts: spending trend (last 6 months bar chart), category breakdown (donut chart), income vs. expenses (stacked bar). Below: recent transactions list (last 10) with date, description, amount, category.

**Category Breakdown View**
Full-screen donut or horizontal bar chart of expenses by category for a selected period. Each segment is clickable to show the underlying expenses. Shows percentage of total and absolute amount.

**VAT Report View**
Structured quarterly VAT summary formatted for UStVA filing. Shows: total revenue, VAT collected (Umsatzsteuer), deductible input VAT (Vorsteuer), net VAT liability (Zahllast). Separated by VAT rate (19%, 7%, 0%). Includes a note about Kleinunternehmer status if applicable.

### Instructions

```
You are a personal expense tracker for freelancers and solopreneurs, with deep knowledge of German tax categories (SKR03).

When the user mentions any spending, proactively log it. "Grabbed a coffee at Starbucks" → add_expense with amount estimated or ask, category meals_personal, vendor Starbucks. If the amount is missing, ask for it — don't guess monetary values.

Always infer the category from context when the user doesn't specify one:
- Software names (AWS, Figma, Notion) → software
- Transport (train, taxi, Uber, flight) → travel or transport depending on context
- Food with clients → meals_business (70% deductible in Germany)
- Food alone → meals_personal (not deductible)

For business meals (Bewirtungskosten), remind the user on first use that only 70% is deductible in Germany and that they need to note the business purpose and attendees for tax compliance. Store this in the description.

When showing summaries, always show amounts in the user's default currency. Format large numbers with thousands separator (€1.234,56 for German locale).

On first use, ask the user two questions:
1. "Are you registered for VAT (Regelbesteuerung) or using the small business exemption (Kleinunternehmerregelung)?"
2. "What's your default currency?"

Store answers via set_preference. These determine VAT behavior for all future entries.

Never suggest tax advice beyond categorization and deductibility hints. Remind users to consult their Steuerberater for filing decisions.
```

---

## Kit 3: Projects

**Triggers:** `project, task, milestone, time, client, deadline, budget, hours, timesheet`

### Positioning

Every "Freelance OS" Notion template tries to be this: a place to track clients, projects, tasks, milestones, and time. The difference is that the user doesn't maintain the kit — they just talk about their work. "Started the brand redesign for Müller GmbH today, deadline is June 15, first milestone is logo concepts by May 20." Tasks accumulate. Status updates happen through conversation.

The kit bridges the gap between CRM (who you work with) and Expenses (what you earn). Projects is where the actual work lives.

### Schema

```sql
-- Migration 001: initial schema

CREATE TABLE clients (
  id TEXT PRIMARY KEY,           -- cli_xxxxx
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  industry TEXT,
  notes TEXT,
  archived_at TEXT DEFAULT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,           -- prj_xxxxx
  client_id TEXT REFERENCES clients(id),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',  -- planning, active, paused, completed, cancelled
  priority TEXT DEFAULT 'medium', -- low, medium, high, urgent
  start_date TEXT,
  due_date TEXT,
  completed_date TEXT,
  budget_cents INTEGER,
  currency TEXT DEFAULT 'EUR',
  hourly_rate_cents INTEGER,     -- if billed hourly
  billing_type TEXT,             -- hourly, fixed, retainer, milestone
  notes TEXT,
  tags TEXT,
  archived_at TEXT DEFAULT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE milestones (
  id TEXT PRIMARY KEY,           -- mil_xxxxx
  project_id TEXT NOT NULL REFERENCES projects(id),
  name TEXT NOT NULL,
  description TEXT,
  due_date TEXT,
  completed_date TEXT,
  status TEXT DEFAULT 'pending', -- pending, in_progress, completed
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,           -- tsk_xxxxx
  project_id TEXT NOT NULL REFERENCES projects(id),
  milestone_id TEXT REFERENCES milestones(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo',    -- todo, in_progress, done, blocked
  priority TEXT DEFAULT 'medium',
  due_date TEXT,
  completed_date TEXT,
  estimated_hours REAL,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE time_entries (
  id TEXT PRIMARY KEY,           -- tim_xxxxx
  project_id TEXT NOT NULL REFERENCES projects(id),
  task_id TEXT REFERENCES tasks(id),
  description TEXT,
  duration_minutes INTEGER NOT NULL,
  billable INTEGER DEFAULT 1,
  entry_date TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_projects_client ON projects(client_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_milestones_project ON milestones(project_id);
CREATE INDEX idx_time_entries_project ON time_entries(project_id);
CREATE INDEX idx_time_entries_date ON time_entries(entry_date);
```

### Tools

| Action | Description | Key Parameters |
|--------|-------------|----------------|
| `add_client` | Add a new client | name, contact_name, contact_email, industry |
| `add_project` | Create a project | name, client (name or id), description, due_date, budget, billing_type, hourly_rate |
| `add_milestone` | Add a milestone to a project | project, name, due_date |
| `add_task` | Add a task to a project (optionally to a milestone) | project, title, milestone, priority, due_date, estimated_hours |
| `update_task` | Update task status or details | task (id or title + project context), status, any field |
| `update_project` | Update project status or details | project, status, any field |
| `log_time` | Log time worked | project, duration (in hours or minutes), task, description, date, billable |
| `list_projects` | List projects with filters | status, client, priority |
| `list_tasks` | List tasks for a project or across all projects | project, status, priority, due_before |
| `project_overview` | Detailed view of a single project: milestones, tasks, time logged, budget status | project |
| `dashboard` | Cross-project overview: active projects, overdue tasks, time logged this week | — |
| `time_report` | Time summary for a period | project, period, billable_only |
| `budget_status` | Budget vs. actual for a project | project |
| `archive` | Soft-delete a project, client, or task | entity type, id |

#### Tool Design Notes

**Time logging shorthand.** The user should be able to say "worked 2 hours on the Müller redesign" and have it logged. The LLM resolves "Müller redesign" to the project, sets duration to 120 minutes, defaults to today, and marks as billable.

**Budget tracking.** For fixed-price projects, budget_status compares budget_cents to total logged time × hourly_rate_cents. For hourly projects, it shows total billable hours × rate. The tool should warn when a project exceeds 80% of budget.

**Task status transitions.** When a user says "finished the wireframes" or "done with the homepage mockup," the LLM should update the task status to "done" and set completed_date. If all tasks in a milestone are done, suggest completing the milestone. If all milestones are done, suggest completing the project.

**Cross-kit potential.** The instructions should note that if the CRM kit is also installed, contacts from the CRM can be referenced as client contacts. This cross-kit awareness is a future feature but the schema should not depend on it.

### Views

**Dashboard View** (default view)
Overview card for each active project: name, client, progress bar (tasks done / total tasks), due date, budget utilization (if applicable). Sorted by due date. Color-coded urgency: red if overdue, yellow if due within 7 days, green otherwise. Below the project cards: "This Week" section showing time logged per project as a horizontal bar chart.

**Project Detail View**
Single-project deep dive. Top: project name, client, status badge, dates, budget meter. Middle: milestone timeline as a horizontal progress visualization, with completed milestones filled and upcoming ones hollow. Below: task list grouped by milestone (or ungrouped if no milestones), with status checkboxes, priority badges, and due dates. Bottom: time log for this project, sortable by date.

**Time Report View**
Time logged across all projects for a selected period. Horizontal stacked bar chart by project per day/week. Summary table: project name, total hours, billable hours, unbillable hours, effective hourly rate (if budget is set). Totals row at bottom.

### Instructions

```
You are a project management assistant for freelancers and consultants.

When the user mentions starting new work for a client, suggest creating a project. When they describe deliverables or phases, suggest milestones. When they mention specific tasks, add them.

Always associate projects with clients. If the user mentions a client that doesn't exist, create one automatically.

Time logging should be frictionless. Accept natural language: "2h on Müller" or "spent the morning on the website redesign" (infer ~4 hours). Always confirm the logged duration before saving if it was inferred rather than explicit.

When the user asks "what should I work on today" or "what's urgent," query tasks sorted by: overdue first, then by priority (urgent > high > medium > low), then by due date. Show maximum 10 tasks across all active projects.

For projects with budgets, proactively warn when approaching 80% utilization. When showing project overviews, always include budget status if a budget is set.

Status updates should feel natural. "Finished the logo concepts" → mark task done. "The Müller project is on hold" → update project status to paused. "We signed off on phase 1" → complete the milestone.

Never show internal IDs. Reference projects by name, tasks by title, clients by name.
```

---

## Kit 4: Content Planner

**Triggers:** `content, post, blog, newsletter, linkedin, idea, publish, schedule, social-media`

### Positioning

Content creation is the dominant solopreneur activity. LinkedIn posts, blog articles, newsletters, social media — most solopreneurs publish across 2-3 channels. The planning lives in spreadsheets, Notion calendars, or nowhere at all. The kit structures the entire content lifecycle: idea → draft → scheduled → published → performance tracked.

The unique value is the LLM layer. "Give me three post ideas based on topics I haven't covered in a while" requires querying the accumulated content history — something no static planner can do.

### Schema

```sql
-- Migration 001: initial schema

CREATE TABLE ideas (
  id TEXT PRIMARY KEY,            -- idea_xxxxx
  title TEXT NOT NULL,
  description TEXT,
  topic TEXT,                     -- broad topic area
  target_channel TEXT,            -- linkedin, blog, newsletter, twitter, instagram, other
  inspiration TEXT,               -- where the idea came from
  priority TEXT DEFAULT 'medium', -- low, medium, high
  status TEXT DEFAULT 'captured', -- captured, developing, ready, rejected
  archived_at TEXT DEFAULT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE content (
  id TEXT PRIMARY KEY,            -- cnt_xxxxx
  idea_id TEXT REFERENCES ideas(id),
  title TEXT NOT NULL,
  body TEXT,                      -- draft text or outline
  channel TEXT NOT NULL,          -- linkedin, blog, newsletter, twitter, instagram, other
  format TEXT,                    -- post, article, carousel, thread, video_script, newsletter
  status TEXT DEFAULT 'draft',    -- draft, review, scheduled, published, repurposed
  scheduled_date TEXT,            -- when to publish
  published_date TEXT,            -- when it was actually published
  published_url TEXT,             -- link to the published piece
  notes TEXT,
  tags TEXT,
  archived_at TEXT DEFAULT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE performance (
  id TEXT PRIMARY KEY,            -- perf_xxxxx
  content_id TEXT NOT NULL REFERENCES content(id),
  impressions INTEGER,
  engagements INTEGER,            -- likes + comments + shares combined
  likes INTEGER,
  comments INTEGER,
  shares INTEGER,
  clicks INTEGER,
  notes TEXT,                     -- qualitative observations
  recorded_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE topics (
  id TEXT PRIMARY KEY,            -- top_xxxxx
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  content_count INTEGER DEFAULT 0, -- denormalized, updated by tools
  last_used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_content_channel ON content(channel);
CREATE INDEX idx_content_status ON content(status);
CREATE INDEX idx_content_published ON content(published_date);
CREATE INDEX idx_ideas_status ON ideas(status);
CREATE INDEX idx_performance_content ON performance(content_id);
```

### Tools

| Action | Description | Key Parameters |
|--------|-------------|----------------|
| `capture_idea` | Save a content idea | title, description, topic, target_channel, priority |
| `create_content` | Create a content piece (optionally from an idea) | title, channel, format, body, idea_id, scheduled_date |
| `update_content` | Update content status, body, or details | content (id or title), status, body, scheduled_date, published_url |
| `log_performance` | Record performance metrics for published content | content (id or title), impressions, engagements, likes, comments, shares, clicks, notes |
| `list_ideas` | List content ideas with filters | status, topic, channel, priority |
| `list_content` | List content pieces with filters | status, channel, format, period |
| `calendar` | Show publishing schedule for a period | period (this_week, next_week, this_month) |
| `topic_analysis` | Show topic coverage: which topics are overdue, which are fresh | — |
| `performance_report` | Performance summary across published content | period, channel |
| `suggest_topics` | Return topics not covered recently or with high past engagement | count (default 5) |
| `archive` | Soft-delete an idea or content piece | entity type, id |
| `add_topic` | Add a new topic to the taxonomy | name, description |

#### Tool Design Notes

**Topic management.** Topics are created implicitly when the user captures ideas or creates content with new topic values. The `topics` table tracks coverage frequency. `suggest_topics` queries topics sorted by `last_used_at ASC` (longest since last use) and cross-references with performance data to surface topics that historically performed well.

**Status flow.** Ideas: captured → developing → ready → rejected. Content: draft → review → scheduled → published → repurposed. Repurposed means the content has been adapted for another channel (e.g., blog post → LinkedIn carousel).

**Performance is manually entered.** Since kits have no internet access, the user reports their own metrics. The instructions should make this feel natural: "My LinkedIn post about AI workflows got 2.3k impressions and 45 comments." The tool parses and stores.

### Views

**Calendar View** (default view)
A week or month calendar grid showing scheduled and published content. Each cell shows content title, channel icon, and status badge. Color-coded by channel (LinkedIn = blue, Blog = green, Newsletter = purple, Twitter/X = gray, Instagram = pink). Empty days are visually distinct to show gaps in the schedule.

**Ideas Board View**
A Kanban board with columns for each idea status (captured, developing, ready). Each card shows the idea title, topic tag, target channel, and priority. The "ready" column is the staging area for ideas that can become content pieces.

**Performance Dashboard View**
Top-line metrics for a selected period: total pieces published, total impressions, total engagements, average engagement rate. Below: a ranked list of content by engagement, showing title, channel, date, and key metrics. A line chart showing engagement trends over time. A topic heatmap showing which topics drive the most engagement.

### Instructions

```
You are a content planning assistant for solopreneurs and consultants who publish across multiple channels.

When the user mentions a content idea — even casually, like "I should write about X" — capture it immediately. Don't let ideas slip through the cracks. Ask about the target channel only if it's not obvious from context.

Maintain a mental model of the user's content rhythm. If they usually post on LinkedIn on Tuesdays and Thursdays, use that pattern when suggesting scheduled dates. Learn this from their publishing history, don't assume.

When the user asks for post ideas, query their topic history first. Prioritize topics they haven't covered recently but that have historically performed well. If they have no performance data yet, suggest based on topic diversity.

For LinkedIn specifically, keep posts under 1300 characters for optimal engagement. For blog posts, suggest a structured outline before a full draft.

When the user publishes something, proactively ask: "Want to log any performance metrics for that piece?" after a reasonable delay (suggest checking back in 24-48 hours for social, 1 week for blog posts).

Repurposing is a key workflow. When content performs well on one channel, suggest adapting it for another: "Your LinkedIn post about AI workflows got great engagement — want me to expand it into a blog post?"

Channel-specific knowledge:
- LinkedIn: 1000-1300 chars optimal, hook in first line, no external links in body
- Blog: SEO-friendly structure, H2/H3 hierarchy, 800-2000 words
- Newsletter: personal tone, one clear CTA, subject line is critical
- Twitter/X: thread format for long-form, single tweet for commentary
```

---

## Kit 5: Decision Journal

**Triggers:** `decision, outcome, principle, reasoning, journal, review, pattern, confidence`

### Positioning

This is the most direct attack on the "Claude doesn't remember" problem and the most novel kit in the catalog. No Notion template handles this well because the value isn't in the data structure — it's in the LLM's ability to reason across accumulated decisions, surface patterns, and connect past reasoning to present choices.

Every important decision the user makes goes here with the reasoning behind it. The compounding value is enormous: "What did I decide about pricing and why?", "Show me decisions I made under time pressure that I later regretted," "Am I falling into the same pattern as last quarter?"

### Schema

```sql
-- Migration 001: initial schema

CREATE TABLE decisions (
  id TEXT PRIMARY KEY,            -- dec_xxxxx
  title TEXT NOT NULL,            -- short decision summary
  context TEXT NOT NULL,          -- what situation prompted this decision
  options_considered TEXT,        -- what alternatives were on the table
  decision TEXT NOT NULL,         -- what was decided
  reasoning TEXT NOT NULL,        -- why this option was chosen
  confidence TEXT,                -- high, medium, low
  urgency TEXT,                   -- high, medium, low — was this a time-pressured decision?
  category TEXT,                  -- business, product, hiring, financial, personal, strategy
  reversibility TEXT,             -- easily_reversible, hard_to_reverse, irreversible
  stakes TEXT,                    -- low, medium, high
  tags TEXT,
  decided_at TEXT NOT NULL,       -- when the decision was made
  review_date TEXT,               -- when to revisit this decision
  archived_at TEXT DEFAULT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE outcomes (
  id TEXT PRIMARY KEY,            -- out_xxxxx
  decision_id TEXT NOT NULL REFERENCES decisions(id),
  outcome TEXT NOT NULL,          -- what actually happened
  assessment TEXT,                -- good, mixed, bad, too_early
  what_i_learned TEXT,            -- retrospective insight
  would_decide_differently INTEGER, -- 0 or 1
  recorded_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE principles (
  id TEXT PRIMARY KEY,            -- pri_xxxxx
  title TEXT NOT NULL,            -- e.g., "Don't make financial decisions when tired"
  description TEXT,
  derived_from TEXT,              -- decision_id(s) that led to this principle
  times_referenced INTEGER DEFAULT 0,
  archived_at TEXT DEFAULT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_decisions_category ON decisions(category);
CREATE INDEX idx_decisions_date ON decisions(decided_at);
CREATE INDEX idx_decisions_review ON decisions(review_date);
CREATE INDEX idx_outcomes_decision ON outcomes(decision_id);
CREATE INDEX idx_outcomes_assessment ON outcomes(assessment);
```

### Tools

| Action | Description | Key Parameters |
|--------|-------------|----------------|
| `log_decision` | Record a decision with full context | title, context, options_considered, decision, reasoning, confidence, urgency, category, reversibility, stakes, review_date |
| `log_outcome` | Record the outcome of a past decision | decision (id or title), outcome, assessment, what_i_learned, would_decide_differently |
| `add_principle` | Extract a personal decision-making principle | title, description, derived_from (decision id) |
| `list_decisions` | List decisions with filters | category, confidence, urgency, assessment (from outcomes), period |
| `search` | Full-text search across decisions, outcomes, and principles | query |
| `review_due` | Show decisions that are due for review | — |
| `patterns` | Analyze decision patterns: common categories, confidence calibration, outcome correlation | period |
| `principles` | List all personal principles | — |
| `decision_detail` | Show a single decision with its outcomes and linked principles | decision (id or title) |
| `calibration` | How well does the user's confidence predict outcomes? | period |
| `archive` | Soft-delete a decision or principle | entity type, id |

#### Tool Design Notes

**The `patterns` tool is the centerpiece.** This is where the LLM earns its keep. It queries all decisions and outcomes, then generates an analysis: "You tend to make financial decisions at low confidence when under time pressure, and these have a higher rate of negative outcomes." or "Your product decisions are well-calibrated — 80% of high-confidence decisions had good outcomes." This cannot be replicated by any static template.

**`calibration` is a Brier-score-like analysis.** It cross-references stated confidence at decision time with actual outcomes. Over time, this teaches the user whether they're overconfident, underconfident, or well-calibrated. The LLM presents this as a conversational insight, not a statistical report.

**Review dates are optional but encouraged.** When logging a decision, the instructions prompt: "When should we revisit this?" Default suggestion: 30 days for reversible decisions, 90 days for irreversible ones.

**Principles are first-class.** When the user logs an outcome with a strong lesson, the LLM should suggest extracting a principle. "It sounds like there's a general principle here — something like 'Always validate pricing assumptions with at least 3 data points before committing.' Want me to save that?" Principles are surfaced when the user faces a similar decision in the future.

### Views

**Decision Timeline View** (default view)
A vertical timeline of decisions, most recent first. Each entry shows the title, category tag, confidence badge, and date. If an outcome has been logged, a small indicator shows the assessment (green dot for good, yellow for mixed, red for bad, gray for too_early). Clicking a decision expands to show full context, reasoning, and outcomes inline.

**Review Queue View**
A focused list of decisions with review_date ≤ today or within the next 7 days. Each item shows the original decision summary, when it was made, and a prompt: "How did this turn out?" This is the view that drives the outcome-logging habit.

**Patterns Dashboard View**
Visualizations of decision-making patterns. A confidence calibration chart (stated confidence vs. outcome quality). A category breakdown showing decision volume and success rate per category. A "decisions under pressure" section highlighting high-urgency decisions and their outcomes. A list of the user's active principles.

### Instructions

```
You are a decision journal assistant that helps the user build self-awareness about their decision-making patterns.

When the user is facing a decision and thinking out loud, suggest logging it. Don't interrupt the thinking process — wait until they've reached a conclusion, then say something like: "That's a meaningful decision. Want me to capture your reasoning so you can revisit it later?"

When logging a decision, guide the user through the key fields conversationally. Don't present a form. Instead, ask naturally:
- "What were the other options you considered?"
- "How confident are you in this choice?"
- "Is this easily reversible if it doesn't work out?"
- "When should we check back on this?"

The reasoning field is the most important. Push for depth here: "Can you tell me more about why you chose this over the alternatives?" The value of the journal depends on capturing genuine reasoning, not just the outcome.

When the user comes back to review a decision, prompt for honest assessment. If they would decide differently, probe why — this is where the learning happens.

After logging several outcomes, proactively offer pattern analysis. "You've logged 15 decisions with outcomes now. Want me to look for patterns?" The patterns tool should surface insights about confidence calibration, category-specific tendencies, and the relationship between urgency and outcome quality.

When the user faces a new decision, search for related past decisions and surface relevant principles. "You made a similar pricing decision in January — you went with the lower rate and later felt you'd undervalued the work. Your principle from that: 'Price for the value delivered, not the time spent.' Does that apply here?"

Tone: reflective, non-judgmental, curious. This is a thinking partner, not a judge.
```

---

## Cross-Kit Considerations

### Naming Conflicts

Each kit uses its own client/contact/company table rather than sharing one across kits. This is deliberate. Kits are independent databases with no foreign key relationships between them. If a user has both CRM and Projects installed, "Müller GmbH" may exist in both. The LLM instructions should acknowledge this: when context is ambiguous, ask "Are you talking about the Müller project or the Müller contact in your CRM?"

### Shared Patterns

All kits share the same structural patterns to reduce cognitive load for the LLM:

- `kit()` always returns: table of installed kits with ID, name, description, action count
- `kit(id)` always returns: kit name, description, available actions with one-line summaries, available views
- `kit(id, cmd)` always returns: action description, parameter JSON schema with types and defaults
- `kit(id, cmd, params)` always returns: structured result with entity ID (for writes) or markdown (for reads)

Write tool responses use `kit.result(kit.created(id, entityType, message))` which produces:
```
✓ created contact con_abc123
Contact "Anna Müller" added. Company: Deloitte.
```

The entity ID (`con_abc123`) is machine-parseable for chaining. The message below is human-readable.

The LLM instructions should encourage "suggested next action" behavior. After `add_contact`, suggest "Want to log an interaction?" After `log_time`, suggest "Want to see the project budget status?" This creates natural multi-step workflows.

### View Conventions

All views follow a consistent design system:

- **Layout:** Mobile-first. Single column default, two-column on wider viewports for dashboards. No horizontal scrolling.
- **Interactivity:** Minimal JavaScript. Sorting and filtering via simple state. No client-side routing. Click-to-expand for detail views. Action buttons use `sendPrompt()` to trigger kit tool calls from the view.

### Launch Priority

Build order based on market demand, schema complexity, and conversion potential:

1. **CRM** — highest demand signal, most universally needed, moderate schema complexity
2. **Expenses** — strong DACH angle, simple schema, high retention (daily use)
3. **Decision Journal** — most novel, strongest "persistence moment," low schema complexity
4. **Projects** — highest schema complexity, overlaps with many existing tools, build after CRM validates the model
5. **Content Planner** — niche audience (content creators), moderate complexity, build last

Decision Journal is prioritized over Projects despite lower demand because it's the kit that best demonstrates what makes kits fundamentally different from Notion templates. It's the one people can't build themselves.
