# Output Formats

Templates for delivering meeting extractions in different formats. The user chooses their preferred format, or use the default (Markdown) if not specified.

---

## Format 1: Slack-Ready

Designed for pasting directly into a Slack channel. Uses emoji markers for visual scanning. Compact.

```
*Meeting Summary: [Title]* — [Date]
Attendees: [Names]

---

*Decisions:*
:white_check_mark: [Decision 1]
:white_check_mark: [Decision 2]

*Action Items:*
:point_right: [Task] — *[Owner]* — Due: [Date]
:point_right: [Task] — *[Owner]* — Due: [Date]
:point_right: [Task] — *[Owner]* — Due: [Date]

*Open Questions:*
:question: [Question] — Who should own: [Name]
:question: [Question] — Who should own: [Name]

*Parking Lot:*
:notepad_spiral: [Item]
:notepad_spiral: [Item]
```

**Slack formatting notes:**
- Use `*bold*` for emphasis (Slack markdown)
- Keep each line under 80 characters for readability
- Use standard Slack emoji codes (`:white_check_mark:`, `:point_right:`, `:question:`, `:notepad_spiral:`)
- No headers (Slack doesn't support `#` headers in regular messages)
- Separate sections with `---`

---

## Format 2: Email-Ready

Designed for sending as a follow-up email to meeting attendees. More narrative, includes context.

```
Subject: [Meeting Title] — Summary & Action Items ([Date])

Hi everyone,

Thanks for today's meeting. Here's a summary of what we covered and what's next.

DECISIONS
---------
- [Decision 1 — stated as a complete sentence]
- [Decision 2 — stated as a complete sentence]

ACTION ITEMS
-----------
- [Owner]: [Task] (due [Date])
- [Owner]: [Task] (due [Date])
- [Owner]: [Task] (due [Date])

OPEN QUESTIONS
--------------
- [Question] — [Suggested owner] to follow up
- [Question] — [Suggested owner] to follow up

PARKING LOT (for future discussion)
------------------------------------
- [Item]
- [Item]

KEY DISCUSSION NOTES
--------------------
[2-3 sentence summary of major discussion topics]

Please flag anything I missed or got wrong. Next meeting: [Date/Time if known].

Best,
[Name]
```

**Email formatting notes:**
- Plain text (no rich formatting — ensures compatibility across email clients)
- Action items grouped by owner (makes it easy for each person to find their tasks)
- Includes a "flag anything I missed" line — this is important for accuracy
- Includes next meeting date if known
- Subject line includes date for easy searching later

### Alternative: Email grouped by owner

When there are 5+ action items, group by owner instead of listing sequentially:

```
ACTION ITEMS
-----------

Sarah:
- [Task 1] (due [Date])
- [Task 2] (due [Date])

Marcus:
- [Task 1] (due [Date])

Tom:
- [Task 1] (due [Date])
- [Task 2] (due [Date])
- [Task 3] (due [Date])
```

---

## Format 3: Notion-Ready

Designed for pasting into a Notion page. Uses Notion-compatible markdown including toggles, callouts, and database properties.

```
# [Meeting Title]

| Property | Value |
|----------|-------|
| Date | [Date] |
| Attendees | [Names] |
| Type | [Strategy / Client Call / Standup / 1-on-1] |
| Status | Processed |

---

## Decisions

> [!note] Decisions Made
> 1. [Decision 1]
> 2. [Decision 2]

---

## Action Items

| Task | Owner | Deadline | Priority | Status |
|------|-------|----------|----------|--------|
| [Task 1] | [Owner] | [Date] | High | To Do |
| [Task 2] | [Owner] | [Date] | Medium | To Do |
| [Task 3] | [Owner] | [Date] | Low | To Do |

---

## Open Questions

> [!question] Unresolved
> - [ ] [Question 1] — @[Owner]
> - [ ] [Question 2] — @[Owner]

---

## Parking Lot

- [Item 1]
- [Item 2]

---

## Discussion Notes

[Summary of key discussion points]

---

## Related
- [[Previous Meeting Notes]]
- [[Project Page]]
```

**Notion formatting notes:**
- Uses Notion-compatible markdown (headers, tables, callout blocks)
- Action items as a table (can be converted to a Notion database view)
- Status column pre-filled with "To Do" (ready for tracking)
- Checkbox format for open questions (can be checked off when resolved)
- "Related" section for linking to other Notion pages
- Property table at top works as metadata for Notion database integration

---

## Format 4: Markdown Table (Default)

The standard format described in SKILL.md. Clean, portable, works everywhere.

```
# Meeting Summary: [Title]

**Date:** [Date]
**Attendees:** [Names]

---

## Decisions Made

1. [Decision]
2. [Decision]

---

## Action Items

| # | Action | Owner | Deadline | Priority |
|---|--------|-------|----------|----------|
| 1 | [Task] | [Name] | [Date] | High |
| 2 | [Task] | [Name] | [Date] | Medium |

---

## Open Questions

1. [Question] — Suggested owner: [Name]
2. [Question] — Suggested owner: [Name]

---

## Parking Lot

- [Item]
- [Item]

---

## Key Discussion Points

[Summary]
```

---

## Format Selection Guide

| Scenario | Best Format |
|----------|------------|
| Quick share to team channel | Slack-Ready |
| Formal follow-up to attendees | Email-Ready |
| Part of a project documentation system | Notion-Ready |
| General purpose / file storage | Markdown (default) |
| Multiple stakeholders, different preferences | Generate Markdown, offer to convert |

When the user doesn't specify a format, use Markdown. If they mention Slack, email, or Notion in their request, use the corresponding format automatically.
