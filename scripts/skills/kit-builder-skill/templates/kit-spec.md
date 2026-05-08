# Kit Spec Template

Fill this out during Phase 1 (Requirements). Get user approval before proceeding.

```markdown
# Kit Spec: <Kit Name>

## Overview
- **Kit ID**: <kebab-case, e.g., "project-tracker">
- **Name**: <Human-readable, e.g., "Project Tracker">
- **Description**: <One line, e.g., "Track freelance projects, tasks, and time">
- **Triggers**: <Comma-separated keywords, e.g., "project, task, time, deadline, milestone">
- **Target user**: <Who uses this, e.g., "Freelancers and small agencies">

## Entities

### <Entity 1: e.g., Projects>
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | text (PK) | yes | nanoid, prefix: prj_ |
| name | text | yes | Project title |
| clientName | text | no | Client company |
| status | text | no | active/on-hold/completed (default: active) |
| budgetAmount | real | no | Budget in EUR |
| deadline | text | no | YYYY-MM-DD |
| notes | text | no | |
| createdAt | text | yes | ISO datetime |
| updatedAt | text | yes | ISO datetime |

### <Entity 2: e.g., Tasks>
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | text (PK) | yes | nanoid, prefix: tsk_ |
| projectId | text (FK) | yes | → projects.id |
| title | text | yes | Task description |
| status | text | no | todo/in-progress/done (default: todo) |
| priority | text | no | high/medium/low (default: medium) |
| deadline | text | no | YYYY-MM-DD |
| createdAt | text | yes | ISO datetime |
| updatedAt | text | yes | ISO datetime |

## Tools

### Write Tools
| Name | Description | Key Params |
|------|-------------|------------|
| add_project | Create a new project | name, clientName?, budget? |
| add_task | Add a task to a project | projectId, title, priority? |
| update_task | Change task status or details | taskId, status?, priority? |
| log_time | Log time spent on a task | taskId, hours, date?, notes? |

### Read Tools
| Name | Description | Key Params |
|------|-------------|------------|
| list_projects | List projects by status | status?, limit? |
| list_tasks | List tasks for a project | projectId, status? |
| project_summary | Dashboard with hours, budget, task stats | projectId |
| search | Search across projects and tasks | query |

## Views
| Name | Type | Purpose |
|------|------|---------|
| dashboard | Dashboard | Project stats, recent activity |
| project-detail | Detail | Single project with tasks and time |
| tasks | Table | All tasks across projects |

## Instructions Outline
- When user mentions a new client project → suggest add_project
- When user mentions tasks or to-dos → suggest add_task
- When user mentions working on something → suggest log_time
- Statuses: active → on-hold → completed
- Priorities: high/medium/low
- Never show IDs, use project and task names
- Format time as "X.X hours", currency as €X,XXX.XX

## Build Order
1. Schema: projects → tasks → time_entries
2. Write tools: add_project → add_task → log_time → update_task
3. Read tools: list_projects → list_tasks → project_summary → search
4. Instructions
5. Views: dashboard → project-detail → tasks
6. Tests → Tool Iterator → Deploy
```

## Notes

- Get user approval on this spec before writing any code
- Entities should have 4-8 fields (not 20)
- Start with 6-10 tools (not 20) — add more later
- Views are optional — tools-only kits are fine for v1
- The Build Order prevents rework: schema → write tools → read tools → views
