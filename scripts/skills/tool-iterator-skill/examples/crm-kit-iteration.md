# Example: CRM Kit — 2-Round Iteration

## Context

A developer built a CRM kit with tools for contacts, deals, and activities. They ran the tool iterator to assess quality before deploying.

## Round 1: Baseline Assessment

### Discovery

```bash
$ rm -f .kitstack/dev.db
$ kitstack call kit
KitStack — 1 app, 8 tools. crm (contacts, deals, pipeline). Call kit() to see all capabilities.

$ kitstack call kit crm
Available actions for crm:
  add_contact      — Add a new contact
  list_contacts    — List all contacts
  add_deal         — Create a deal
  list_deals       — List deals
  update_deal      — Update deal stage
  add_activity     — Log an activity
  get_contact      — Get contact details
  pipeline         — Show pipeline overview
```

### Workflow Chain 1: Contact → Deal → Activity

```bash
$ kitstack call kit crm add_contact '{"name":"Sarah Chen","company":"Acme Corp","email":"sarah@acme.co"}'
Contact Sarah Chen added successfully.

$ kitstack call kit crm add_deal '{"name":"Acme Website Redesign","contactId":"???","value":25000}'
# Problem: add_contact didn't return an ID. How do we get contactId?
```

**Issue found:** `add_contact` returns plain text without a structured ID. Chaining is broken at step 1.

### Workaround: List to get ID

```bash
$ kitstack call kit crm list_contacts '{}'
| Name | Company | Email |
|------|---------|-------|
| Sarah Chen | Acme Corp | sarah@acme.co |

# Still no ID visible! The list doesn't show IDs either.
```

**Second issue:** `list_contacts` doesn't include entity IDs in the response. Even if we could get the ID from add_contact, there's no way to discover IDs for existing contacts.

### Param Description Check

```bash
$ kitstack call kit crm add_deal
Parameters:
  name: string
  contactId: string
  value: number
  stage: string (optional)
```

**Third issue:** `contactId` has no `.describe()` — shows as bare `string`. `stage` is also bare `string` with no enum values visible.

### Error Handling Check

```bash
$ kitstack call kit crm add_contact '{}'
Error: Invalid arguments

$ kitstack call kit crm add_deal '{"name":"Test","contactId":"nonexistent","value":1000}'
✓ created deal abc789
Deal "Test" created.
```

**Fourth issue:** `add_deal` accepts a nonexistent `contactId` without validation. It should return `kit.notFound("contact", id)` or at least warn.

### Round 1 Report

```markdown
## Tool Iterator Report: crm

### Summary
- **Actions discovered**: 8 total (3 write, 5 read)
- **Actions tested**: 8/8
- **Workflow chains tested**: 2
- **Issues found**: 6 (critical: 2, warning: 3, suggestion: 1)

### Write Response Audit

| Action | Returns ID? | Entity Type | Format Correct? | Chainable? |
|--------|------------|-------------|-----------------|------------|
| add_contact | no | — | ✗ plain text | ✗ |
| add_deal | yes | deal | ✓ `✓ created deal <id>` | ✓ |
| add_activity | yes | activity | ✓ `✓ created activity <id>` | ✓ |
| update_deal | no | — | ✗ plain text "Updated." | ✗ |

### Param Description Audit

| Action | Params with .describe() | Params missing .describe() |
|--------|------------------------|----------------------------|
| add_contact | name | company, email, phone |
| add_deal | name | contactId, value, stage |
| add_activity | description | contactId, dealId, type |

### Issues

1. **[critical]** `add_contact` returns plain text "Contact Sarah Chen added successfully" without entity ID. LLMs cannot chain contact creation into deal creation. **Fix:** `return kit.result(kit.created(id, "contact", msg))`

2. **[critical]** `update_deal` returns "Updated." without the deal ID or what changed. LLMs can't confirm the update or chain it. **Fix:** `return kit.result(kit.updated(dealId, "deal", msg))`

3. **[warning]** `contactId` on add_deal, add_activity has no `.describe()`. LLMs may pass wrong values. **Fix:** `.describe("Contact ID from add_contact")`

4. **[warning]** `stage` on add_deal is a bare `string` — should be `z.enum(["lead","qualified","proposal","negotiation","closed-won","closed-lost"])` so LLMs see valid values.

5. **[warning]** `add_deal` accepts nonexistent contactId without error. Should validate the contact exists first. **Fix:** query contacts table, return `kit.notFound("contact", args.contactId)` if missing.

6. **[suggestion]** `list_contacts` doesn't show entity IDs. While IDs shouldn't be shown to users, the LLM needs them for chaining. Include IDs in the response for LLM consumption.
```

## Round 2: After Fixes

Developer fixed all 6 issues. Rerunning:

```bash
$ rm -f .kitstack/dev.db

$ kitstack call kit crm add_contact '{"name":"Sarah Chen","company":"Acme Corp","email":"sarah@acme.co"}'
✓ created contact ct_a1b2c3
Contact "Sarah Chen" added. Company: Acme Corp.

$ kitstack call kit crm add_deal '{"name":"Acme Website Redesign","contactId":"ct_a1b2c3","value":25000,"stage":"proposal"}'
✓ created deal dl_x7y8z9
Deal "Acme Website Redesign" created for Sarah Chen. Value: €25,000. Stage: proposal.

$ kitstack call kit crm add_activity '{"contactId":"ct_a1b2c3","dealId":"dl_x7y8z9","type":"meeting","description":"Kickoff meeting at Acme HQ"}'
✓ created activity ac_m4n5o6
Activity logged: meeting with Sarah Chen re: Acme Website Redesign.

$ kitstack call kit crm update_deal '{"dealId":"dl_x7y8z9","stage":"negotiation"}'
✓ updated deal dl_x7y8z9
Deal "Acme Website Redesign" stage changed to "negotiation".

$ kitstack call kit crm pipeline '{}'
## Pipeline Overview
| Stage | Deals | Total Value |
|-------|-------|-------------|
| negotiation | 1 | €25,000 |
| **Total** | **1** | **€25,000** |
```

### Round 2 Report

```markdown
## Tool Iterator Report: crm (Round 2)

### Summary
- **Actions tested**: 8/8
- **Workflow chains tested**: 3
- **Issues found**: 1 (critical: 0, warning: 0, suggestion: 1)
- **Issues fixed since Round 1**: 6/6 ✓

### All chains pass ✓
1. Contact → Deal → Activity: ✓ All IDs chain correctly
2. Create → Search → Update → Read: ✓
3. Error handling: ✓ Invalid contactId returns "Contact not found"

### Remaining Suggestion
1. **[suggestion]** No `search_contacts` tool — only `list_contacts` (returns all). For kits with 20+ contacts, a search tool prevents dumping the full table. Low priority for launch.

### Verdict: Ready for deployment ✓
```
