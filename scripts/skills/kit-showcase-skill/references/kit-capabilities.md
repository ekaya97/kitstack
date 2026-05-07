# Kit Capabilities

What each KitStack kit does, its tools, its views, and its primary use cases. Use this reference when users ask "what can kits do?" or want to know about a specific kit.

---

## What Is a Kit?

A kit is an MCP (Model Context Protocol) app with a database. It installs into Claude.ai (or any MCP-compatible AI) and gives the AI persistent tools — the ability to store, retrieve, and analyze your data across conversations.

**Skills vs. Kits:**
- A **skill** is a knowledge file. It makes the AI an expert at a topic (writing proposals, reviewing contracts). Skills live in a single conversation — when the conversation ends, the skill is still available but has no memory of past conversations.
- A **kit** is a tool with a database. It gives the AI the ability to DO things with YOUR data — add contacts, log expenses, record decisions. The data persists. Each conversation builds on the last.

**Analogy:** A skill is like hiring a consultant for a meeting. A kit is like hiring an assistant who keeps your files organized and remembers everything.

---

## Kit 1: CRM Kit

**One-liner:** Track contacts, log interactions, and never forget to follow up.

### Tools
| Tool | What it does |
|------|-------------|
| `addContact` | Add a new contact: name, company, role, email, notes |
| `logInteraction` | Log a meeting, call, email, or message with a contact |
| `searchContacts` | Search by name, company, tag, or keyword |
| `getFollowUps` | Get contacts that are overdue for follow-up based on last interaction date |
| `addTag` | Tag contacts for segmentation (lead, client, partner, etc.) |
| `updateContact` | Update contact info or notes |

### Views
| View | What it shows |
|------|-------------|
| Dashboard | Overview: total contacts, recent interactions, follow-ups due |
| Contact Detail | Full profile of a contact with interaction history |

### Use Cases
- **Freelancers:** Track clients and leads. Know when to follow up. Never forget who you met at a conference.
- **Founders:** Manage investor relationships, customer contacts, and partnership leads.
- **Salespeople:** Lightweight CRM for individual contributors who don't need Salesforce.
- **Networkers:** Track people you meet, notes from conversations, follow-up reminders.

### Value Over Time
| Time using | What you get |
|-----------|-------------|
| 1 week | 10-20 contacts entered, basic follow-up reminders |
| 1 month | Full contact database, interaction history, pattern recognition ("you mostly meet people through events, not cold outreach") |
| 3 months | Network intelligence: who refers you clients, which relationships are dormant, who you're over-investing in |

---

## Kit 2: Expense Kit

**One-liner:** Log expenses in natural language, get categorized summaries and insights.

### Tools
| Tool | What it does |
|------|-------------|
| `logExpense` | Log an expense: amount, description, category, date |
| `getExpenses` | Retrieve expenses by date range, category, or amount |
| `getSummary` | Get spending summary for a period: totals by category, trends, anomalies |
| `setCategory` | Add or update expense categories |
| `setBudget` | Set budget targets by category |

### Views
| View | What it shows |
|------|-------------|
| Monthly Overview | Spending by category, budget vs. actual, daily spending chart |
| Category Breakdown | Drill-down into a specific category with line items |

### Use Cases
- **Freelancers:** Track deductible expenses for tax season without a spreadsheet.
- **Small business owners:** Monitor monthly spending by category.
- **Travelers:** Log trip expenses in real-time and get a summary at the end.
- **Budget-conscious individuals:** Track personal spending with natural language ("spent EUR 45 on groceries").

### Value Over Time
| Time using | What you get |
|-----------|-------------|
| 1 week | A few expenses logged, basic categorization |
| 1 month | Full monthly summary, category breakdown, spending patterns visible |
| 3 months | Trend analysis ("your software costs went up 20% this quarter"), budget tracking, tax-ready category totals |

---

## Kit 3: Decision Journal Kit

**One-liner:** Record decisions, their reasoning, and outcomes — build a record of how you think.

### Tools
| Tool | What it does |
|------|-------------|
| `logDecision` | Record a decision: what, options considered, choice made, reasoning, confidence level |
| `logOutcome` | Update a past decision with its outcome: what happened, was it the right call? |
| `getDecisions` | Retrieve decisions by date, topic, or confidence level |
| `getPatterns` | Analyze decision patterns: types of decisions, confidence calibration, recurring themes |
| `getOpenDecisions` | List decisions that haven't been reviewed for outcomes yet |

### Views
| View | What it shows |
|------|-------------|
| Decision Timeline | Chronological list of decisions with confidence and outcome status |
| Pattern Analysis | Insights on decision-making patterns, confidence calibration |

### Use Cases
- **Founders:** Track strategic decisions and revisit them. Learn whether your gut is calibrated.
- **Managers:** Record hiring decisions, project priorities, and process changes. Review what worked.
- **Investors:** Log investment decisions with reasoning. Compare predictions to outcomes.
- **Anyone facing a tough choice:** Structure your thinking. Write down the options and reasoning. Come back later to see if the decision held up.

### Value Over Time
| Time using | What you get |
|-----------|-------------|
| 1 week | 1-2 decisions recorded with structured reasoning |
| 1 month | 5-10 decisions logged, starting to see patterns in how you decide |
| 3 months | Confidence calibration ("when you're at 8/10 confidence, you're right 90% of the time; at 5/10, only 50%"), recurring themes, outcome tracking |

---

## Kit 4: Content Planner Kit

**One-liner:** Plan, schedule, and track content across platforms.

### Tools
| Tool | What it does |
|------|-------------|
| `addContent` | Plan a content piece: topic, platform, format, status, publish date |
| `getCalendar` | View upcoming content by date range |
| `updateStatus` | Update content status: idea → draft → review → published |
| `getIdeas` | Retrieve all content ideas (status: idea) for brainstorming |
| `getAnalytics` | View publishing frequency, platform distribution, topic coverage |

### Views
| View | What it shows |
|------|-------------|
| Content Calendar | Visual calendar with content pieces, color-coded by status |
| Analytics Dashboard | Publishing cadence, platform mix, topic distribution |

### Use Cases
- **Content creators:** Plan and track content across LinkedIn, Twitter, blog, newsletter.
- **Marketing teams:** Shared editorial calendar with status tracking.
- **Founders building in public:** Track what to post and when, maintain consistency.

---

## Kit 5: Project Kit

**One-liner:** Track projects, tasks, and progress in natural language.

### Tools
| Tool | What it does |
|------|-------------|
| `createProject` | Start a new project with name, description, deadline |
| `addTask` | Add a task to a project: description, priority, due date |
| `updateTask` | Update task status: todo → in-progress → done |
| `getProjectStatus` | Overview of a project: progress, upcoming tasks, blockers |
| `getOverdue` | List overdue tasks across all projects |

### Views
| View | What it shows |
|------|-------------|
| Project Dashboard | All active projects with progress bars and next actions |
| Task Board | Kanban-style view of tasks by status |

### Use Cases
- **Freelancers:** Track client projects and deliverables.
- **Small teams:** Lightweight project management without Jira or Asana.
- **Solo founders:** Track product development, marketing tasks, and operational to-dos.

---

## Cross-Kit Value

The real power emerges when kits work together:

- **CRM + Content Planner:** "Draft a LinkedIn post about the topic Maria Chen mentioned in our last meeting" — the CRM knows about Maria, the Content Planner tracks the post.
- **CRM + Expense:** "How much have I spent on client entertainment for Riviera Health this quarter?" — cross-referencing contacts with expenses.
- **Decision Journal + any kit:** "Am I making the same mistake again?" — decisions inform future actions across all tools.

This cross-kit intelligence is the long-term vision. Each kit is valuable alone. Together, they become your operating system.
