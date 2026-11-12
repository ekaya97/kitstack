# Iteration Report Template

After completing your test workflow and evaluation, produce the report in this structure. Adapt content to actual findings — sections are fixed, content is specific.

```markdown
## Tool Iterator Report: <kit name> (Round <N>)

### Summary
- **Actions discovered**: X total (Y write, Z read)
- **Actions tested**: X/Y
- **Workflow chains tested**: N
- **Issues found**: N (critical: X, warning: Y, suggestion: Z)
- **Issues fixed since last round**: N/N (if Round 2+)

### Write Response Audit

| Action | Returns ID? | Entity Type | Format Correct? | Chainable? |
|--------|------------|-------------|-----------------|------------|
| add_contact | yes | contact | ✓ `✓ created contact <id>` | ✓ |
| add_deal | yes | deal | ✓ `✓ created deal <id>` | ✓ |
| update_deal | no | — | ✗ returns plain text | ✗ |

Mark each action:
- ✓ if it returns `✓ <op> <entityType> <id>` format
- ✗ if it returns plain text, JSON dump, or "Success"
- Chainable = the next tool in the workflow can extract and use the returned ID

### Param Description Audit

| Action | Params with .describe() | Params missing .describe() |
|--------|------------------------|----------------------------|
| add_contact | name, email | company, phone |
| add_deal | name | contactId (bare string), value, stage |

Flag every param that:
- Has no .describe() at all
- Has .describe() but no format hint (dates, currencies, IDs)
- Is an enum disguised as a string

### Workflow Chains Tested

For each chain, show the full sequence and result:

**1. Contact → Deal → Activity**
```
add_contact("Sarah Chen") → ✓ ct_a1b2c3
add_deal(contactId: ct_a1b2c3, "Acme Redesign") → ✓ dl_x7y8z9
add_activity(dealId: dl_x7y8z9, "Kickoff meeting") → ✓ ac_m4n5o6
```
Result: ✓ All IDs chained correctly

**2. Create → Search → Update → Read**
```
add_contact("Sarah Chen") → ✓ ct_a1b2c3
search_contacts("Sarah") → found 1 result
update_contact(ct_a1b2c3, email: "new@acme.co") → ✓ updated
get_contact(ct_a1b2c3) → email shows "new@acme.co"
```
Result: ✓ Full CRUD cycle works

**3. Error handling**
```
add_contact({}) → ✓ returns validation error
add_deal(contactId: "nonexistent") → ✓ returns "Contact not found"
```
Result: ✓ / ✗

### Issues

Use severity tags:
- **[critical]** — Breaks LLM workflow chaining or causes data loss
- **[warning]** — Degrades LLM experience or causes confusion
- **[suggestion]** — Improvement that would make the kit better

For each issue:
1. **[severity]** What's wrong — one sentence
2. Impact on LLM orchestration — why this matters
3. **Fix:** specific code change with before/after if possible

Example:
1. **[critical]** `add_contact` returns plain text without entity ID.
   LLMs cannot chain contact creation into deal creation — the entire contact → deal → activity workflow is broken.
   **Fix:** Change `return kit.text(msg)` to `return kit.result(kit.created(id, "contact", msg))`

### Suggestions

#### Trigger keywords to add
Current: `<current triggers>`
Suggested additions: `<new triggers>`
Reason: <why these match user intent>

#### Missing actions
- `<tool_name>` — <what it would do and why it's needed>

#### Description improvements
- `<tool>`: change "<current>" → "<improved>"

#### Instructions improvements
- Add: "<behavioral trigger or domain knowledge>"

### Verdict

One of:
- **Ready for deployment** ✓ — all chains pass, no critical issues
- **Fix N critical issues first** — list them
- **Needs another round** — significant issues remain
```

## Report Writing Guidelines

1. **Be specific.** "add_deal has issues" is useless. Show the exact command, the exact output, and the exact impact.
2. **Frame everything as LLM impact.** The audience is a developer who wants their kit to work well under LLM orchestration.
3. **Include the fix.** Every issue should have a concrete code suggestion.
4. **If everything passes, say so.** A clean report is valuable — it means the kit is ready.
5. **If you couldn't test something, say what you tried and what happened.**
6. **Order issues by severity.** Critical first, then warning, then suggestion.
7. **For Round 2+, show the delta.** What improved, what's still open, what regressed.
