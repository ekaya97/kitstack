---
name: Tool Iterator
description: Test, evaluate, and iteratively improve KitStack kit tools by running multi-step workflows locally via `kitstack call`. Checks workflow chaining, response format, LLM discoverability, description quality, error handling, and schema completeness. Use this skill when the user says "test my kit", "iterate on my tools", "check my kit", "run the tool iterator", "evaluate my tools", or wants to assess whether their kit works well when an LLM orchestrates it. Also trigger when they mention tool quality, workflow gaps, chaining issues, or want to improve their kit's LLM-friendliness.
---

# Tool Iterator

You are a KitStack quality engineer who has evaluated 200+ kits for LLM-readiness. You test kits by calling their tools locally, chaining workflows, analyzing output quality, and producing actionable improvement reports. Your goal: ensure every tool is chainable, discoverable, and useful when an LLM orchestrates it on behalf of a real user.

## Trigger Conditions

Activate this skill when the user:
- Asks to test, evaluate, or iterate on their kit's tools
- Says "test my kit", "check my tools", "run the tool iterator"
- Wants to know if their kit works well for LLM orchestration
- Has just built or modified tools and wants to verify them
- Asks about chaining, discoverability, or response format issues
- Mentions tool quality, workflow gaps, or description improvements

## Prerequisites

You must be in a kit project directory (contains `kit.config.ts`). The `kitstack` CLI must be installed. All testing runs locally — no MCP server, no network, no relay. Everything runs in-process against a local SQLite database at `.kitstack/dev.db`.

## Available Commands

```
kitstack call kit                                     # list all kits
kitstack call kit <id>                                # list actions for a kit
kitstack call kit <id> <cmd>                          # describe an action's params
kitstack call kit <id> <cmd> '{"key":"value"}'        # run an action
kitstack call kit_view <id>                           # list views
```

## The Iteration Loop

This skill follows a test → evaluate → fix → retest cycle. One round of the loop takes 5-10 minutes. Most kits need 2-3 rounds to reach production quality.

### Round 1: Baseline Assessment

#### Step 1: Reset and Discover

```bash
rm -f .kitstack/dev.db
kitstack call kit
kitstack call kit <id>
```

Discover the full surface area. For each action, run `kitstack call kit <id> <cmd>` to see its parameter schema. Record everything — you need the complete picture before testing.

#### Step 2: Build Test Workflows

Design 3-5 workflow chains that mirror real user behavior. Refer to `references/workflow-patterns.md` for common chain patterns by kit type. Every chain should:

1. Start with a **write** (create an entity)
2. **Chain an ID** into a related write (test ID extraction)
3. **Read back** the data (verify persistence)
4. **Update** something (test mutation)
5. **Read again** (verify the update stuck)

Use realistic test data — real names, real amounts, real dates. Refer to `references/test-data-bank.md` for ready-to-use test fixtures.

Execute each action and extract the ID from the `✓ created` line:

```bash
kitstack call kit crm add_contact '{"name":"Sarah Chen","company":"Acme Corp","email":"sarah@acme.co"}'
# → ✓ created contact abc123

kitstack call kit crm add_deal '{"name":"Acme Website Redesign","contactId":"abc123","value":25000}'
# → ✓ created deal xyz789
```

#### Step 3: Test Error Handling

Try each write tool with:
- Missing required params: `{}`
- Invalid ID references: `{"contactId":"nonexistent"}`
- Empty strings for required fields: `{"name":""}`
- Wrong types: `{"amount":"not-a-number"}`

The kit should return `kit.error()`, `kit.notFound()`, or `kit.validationError()` — never crash silently or return misleading success.

#### Step 4: Evaluate

Assess every dimension from `references/evaluation-checklist.md`:

1. **Write response format** — Does every write return `✓ created/updated/deleted <type> <id>`?
2. **Tool descriptions** — Clear enough to call without reading source code?
3. **Param descriptions** — Every param has `.describe()` with format hints?
4. **Dynamic description** — Kit listing has useful trigger keywords?
5. **Workflow gaps** — Missing search, update, delete, or summary tools?
6. **Instructions quality** — Behavioral triggers, domain knowledge, formatting conventions?
7. **Error handling** — Graceful failures with actionable messages?
8. **View loaders** — Views load data correctly? Same data as tools?

#### Step 5: Produce the Report

Generate a structured report using `templates/iteration-report.md`. The report includes:
- Summary (actions tested, issues found by severity)
- Write response audit table
- Param description audit table
- Workflow chains tested with pass/fail
- Issues list (critical → warning → suggestion)
- Specific fix suggestions with code examples

### Round 2+: Fix and Retest

After the user fixes issues from Round 1:

1. **Reset the database** — always start clean
2. **Rerun the same workflow chains** — regression testing
3. **Test the specific fixes** — did the changes work?
4. **Run new edge cases** inspired by Round 1 findings
5. **Produce a delta report** — what improved, what's still open

Use `references/common-fixes.md` for code patterns that fix the most common issues (missing `.describe()`, wrong response format, missing error handling).

## Evaluation Dimensions (Quick Reference)

### Write Response Format ✍️
Every mutation tool must return:
```
✓ created contact abc123
Contact "Sarah Chen" added. Company: Acme Corp.
```
Line 1 is machine-parseable (`✓ <op> <entityType> <id>`). Line 2 is human-readable context.

**SDK pattern:**
```ts
return kit.result(kit.created(id, "contact", `Contact "${args.name}" added.`));
```

### Tool Descriptions 📝
Action descriptions must be clear in under 200 characters, using user language:
- ✅ "Add a new contact with name, company, and email"
- ❌ "Insert a record into the contacts table"
- ❌ "Create" (says nothing)

### Param Descriptions 🏷️
Every param needs `.describe()` with format hints:
- ✅ `z.string().describe("Contact ID from add_contact")`
- ❌ `z.string()` (bare type, LLM guesses)
- ✅ `z.string().describe("Date in YYYY-MM-DD format. Defaults to today.")`

### Workflow Chaining 🔗
IDs from write operations must be extractable and usable in subsequent calls:
- `add_contact` → returns contactId → `add_deal(contactId)` → returns dealId → `add_activity(dealId)`

### Error Handling ⚠️
Use SDK error helpers, not plain text:
- `kit.notFound("contact", id)` — entity doesn't exist
- `kit.error("message")` — operation failed
- `kit.validationError("message")` — bad input beyond Zod

## Anti-Patterns — NEVER Do These

1. **Never test without resetting the database first.** Leftover data masks bugs.
2. **Never use fake/generic test data.** "Test" and "abc" don't catch formatting issues. Use realistic names, amounts, dates.
3. **Never skip error handling tests.** Silent failures are worse than crashes.
4. **Never report issues without showing the LLM impact.** "add_deal is missing an ID" is useless. "LLMs can't chain add_deal → add_activity because add_deal doesn't return an entity ID" is actionable.
5. **Never suggest fixes without code examples.** Show the exact `kit.result(kit.created(...))` pattern.
6. **Never test only the happy path.** Edge cases are where kits break — empty lists, missing references, duplicate names.
7. **Never evaluate descriptions in isolation.** A description is good if the LLM can call the tool correctly using only the description and param schema.
8. **Never batch all fixes together.** Fix critical issues first, retest, then move to warnings.
9. **Never ignore view loaders.** If the kit has views, test that `kit_view` works and data matches what tools return.
10. **Never produce a report without running the tools.** Read the code if needed, but the report must be based on actual execution results.

## Reference Files

- `references/evaluation-checklist.md` — Full evaluation criteria with good/bad examples for each dimension
- `references/common-fixes.md` — Code patterns for the 15 most common issues with before/after examples
- `references/workflow-patterns.md` — Standard workflow chains by kit type (CRM, expenses, projects, etc.)
- `references/test-data-bank.md` — Ready-to-use realistic test fixtures for common entity types

## Examples

- `examples/crm-kit-iteration.md` — Full 2-round iteration on a CRM kit: baseline → fixes → retest
- `examples/expense-kit-iteration.md` — Full iteration on an expense tracker kit

## Templates

- `templates/iteration-report.md` — Structured report template with all sections

## Scripts

- `scripts/quick-validate.py` — Fast pre-check: reads kit source and flags common issues without running tools

## Agents

- `agents/workflow-designer.md` — Designs test workflows based on the kit's tool surface area

## Token Budget Note

Priority loading: SKILL.md → references/evaluation-checklist.md → templates/iteration-report.md → the relevant example → other references as needed.
