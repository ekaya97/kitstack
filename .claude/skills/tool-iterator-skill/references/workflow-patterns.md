# Workflow Patterns

Standard workflow chains to test for common kit types. Pick the chains that match the kit's domain.

## CRM Kit

### Chain 1: Contact → Deal → Activity (core chain)
```
add_contact → add_deal(contactId) → add_activity(dealId, contactId)
```
Tests: ID chaining across 3 entities, cross-entity references.

### Chain 2: Create → Search → Update → Read
```
add_contact → search_contacts("Sarah") → update_contact(contactId, {email: "new@email.com"}) → get_contact(contactId)
```
Tests: search returns the right entity, update persists, read reflects changes.

### Chain 3: Pipeline lifecycle
```
add_deal(stage: "lead") → update_deal(stage: "qualified") → update_deal(stage: "proposal") → pipeline_dashboard
```
Tests: stage progression, dashboard reflects changes.

### Chain 4: Bulk then summarize
```
add_contact × 3 → add_deal × 3 → list_contacts → list_deals → pipeline_dashboard
```
Tests: multiple entities, list pagination, summary accuracy.

---

## Expense / Finance Kit

### Chain 1: Add → List → Summarize
```
add_expense × 5 (different categories) → list_expenses → quarterly_summary
```
Tests: categorization, aggregation math, date handling.

### Chain 2: Import → Review → Categorize
```
import_csv(file) → list_expenses(uncategorized) → categorize(expenseId)
```
Tests: CSV parsing, filter by status, category assignment.

### Chain 3: Tax workflow
```
add_expense(vat: 19%) → add_expense(vat: 7%) → add_expense(vat: 0%) → quarterly_summary
```
Tests: multiple VAT rates, correct tax calculations.

### Chain 4: Update → Delete → Verify
```
add_expense → update_expense(category: "travel") → delete_expense → list_expenses
```
Tests: update persists, delete works, deleted item gone from list.

---

## Project / Task Kit

### Chain 1: Project → Tasks → Time
```
add_project → add_task(projectId) × 3 → log_time(taskId) → project_summary
```
Tests: project-task hierarchy, time aggregation.

### Chain 2: Status progression
```
add_task(status: "todo") → update_task(status: "in_progress") → update_task(status: "done") → list_tasks(status: "done")
```
Tests: status transitions, filtering by status.

### Chain 3: Milestone tracking
```
add_project → add_milestone(projectId, deadline) → add_task(milestoneId) × 2 → milestone_status
```
Tests: milestone-task relationship, deadline tracking.

---

## Content / Publishing Kit

### Chain 1: Idea → Draft → Published
```
add_idea → create_draft(ideaId) → update_draft(status: "published") → list_published
```
Tests: content lifecycle, status filtering.

### Chain 2: Calendar workflow
```
add_idea × 5 → schedule_post(ideaId, date) × 3 → content_calendar
```
Tests: scheduling, calendar view accuracy.

---

## Decision Journal Kit

### Chain 1: Log → Review
```
log_decision(context, reasoning) → list_decisions → get_decision(decisionId)
```
Tests: rich text storage, retrieval.

### Chain 2: Track outcomes
```
log_decision → update_outcome(decisionId, outcome) → decisions_with_outcomes
```
Tests: deferred updates, querying by outcome status.

---

## Generic Patterns (Any Kit)

### CRUD Completeness Test
For each entity type, verify all four operations:
```
create → read → update → delete → read (should be gone)
```

### Empty State Test
Before any writes, call every read/list/summary tool:
```
list_* → should return "No X found" message, not error
dashboard → should handle empty state gracefully
```

### Cross-Entity Integrity Test
Create parent → create child → delete parent → check child:
```
add_contact → add_deal(contactId) → delete_contact → list_deals
```
Question: Does the deal still reference the deleted contact? Is there a warning?

### Duplicate Handling Test
Create the same entity twice:
```
add_contact(name: "Sarah Chen") → add_contact(name: "Sarah Chen")
```
Question: Does the kit handle duplicates? Reject? Warn? Allow?

### Boundary Tests
- Very long text (500+ character description)
- Special characters (umlauts: Müller, emoji: 🎯, quotes: O'Brien)
- Zero values (amount: 0, quantity: 0)
- Future dates (year 2030)
- Past dates (year 2020)
