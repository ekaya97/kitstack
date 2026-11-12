# Evaluation Checklist

Use this checklist after executing your test workflows. Each section has criteria to assess, with examples of good and bad patterns.

## 1. Write Response Format

Every mutation tool (create, update, delete) must return a structured first line that an LLM can parse, followed by a human-readable message.

**Expected format:**
```
✓ created contact abc123
Contact "Sarah Chen" added. Company: Acme Corp.

✓ updated deal xyz789
Deal stage moved to negotiation.

✓ deleted activity def456
Activity removed.
```

**SDK pattern (correct):**
```ts
return kit.result(kit.created(id, "contact", `Contact "${args.name}" added.`));
return kit.result(kit.updated(id, "deal", `Deal stage changed to "${args.stage}".`));
return kit.result(kit.deleted(id, "expense", `Expense "${expense.description}" deleted.`));
```

**What to check:**
- [ ] Every write tool returns `✓ <op> <entityType> <id>` on the first line
- [ ] Entity type is specific (`contact`, `deal`, `expense`) not generic (`item`, `record`)
- [ ] ID is a real unique identifier (nanoid, uuid) — not a row number or timestamp
- [ ] Human-readable message adds context beyond the structured line
- [ ] Multi-mutation responses list each mutation separately
- [ ] Batch writes use array form: `kit.result(ids.map(id => kit.created(id, "contact", msg)))`

**Bad patterns to flag:**

| Pattern | Problem | Impact | Fix |
|---------|---------|--------|-----|
| Returns `kit.text("Contact added")` | No parseable ID | LLM can't chain | Use `kit.result(kit.created(id, ...))` |
| Returns only the ID: `"abc123"` | No entity type | LLM doesn't know what was created | Use `kit.created(id, "contact", msg)` |
| Returns JSON dump: `{id: "abc123", ...}` | Verbose, unstructured | LLM wastes tokens parsing | Use `kit.result()` |
| Returns "Success" | No ID, no context | Workflow broken | Use `kit.result(kit.created(...))` |

## 2. Tool Descriptions

Tool descriptions are what the LLM reads when deciding which tool to call. They need to be clear at two levels: the action description and the param descriptions.

### Action descriptions
- [ ] Each description says what the tool does in under 200 characters
- [ ] Descriptions use user language ("Add a new contact" not "Insert into contacts table")
- [ ] Read vs write intent is clear from the description alone
- [ ] Description mentions the key params ("Add a new contact with name, company, and email")

### Param descriptions
- [ ] Every parameter has a `.describe()` annotation
- [ ] Descriptions include format hints: "Date in YYYY-MM-DD format", "Amount in EUR"
- [ ] Enum values are visible in the description or schema
- [ ] Optional vs required is clear
- [ ] ID params say what entity they reference: "Contact ID from add_contact" not just "ID"
- [ ] Default values are mentioned: "Max results (default: 10)"

**Good vs bad descriptions:**

| Good | Bad | Why |
|------|-----|-----|
| `z.string().describe("Contact ID from add_contact")` | `z.string()` | LLM knows which ID to pass |
| `z.string().describe("Date in YYYY-MM-DD. Defaults to today.")` | `z.string().optional()` | LLM knows the format |
| `z.enum(["won","lost","open"]).describe("Deal stage")` | `z.string().describe("Stage")` | LLM sees valid values |
| `z.number().describe("Gross amount in EUR")` | `z.number()` | LLM knows the unit |

## 3. Dynamic Description (Discoverability)

When an LLM calls `kitstack call kit`, it sees a listing. This is the first impression.

**What to check:**
- [ ] Kit name and description are present
- [ ] Description front-loads the most important capability
- [ ] Trigger keywords match what users actually say
- [ ] Triggers use nouns and verbs users would use, not developer terms

**Good triggers vs bad triggers:**

| Good | Bad | Why |
|------|-----|-----|
| `contacts, deals, pipeline, follow-up` | `customer relationship management` | Users say "add a contact" |
| `expense, receipt, Steuerberater, tax` | `financial tracking` | Match domain nouns |
| `log an expense, track spending` | `CRUD operations` | Verb phrases match intent |

## 4. Workflow Gaps

After running a full create → read → update → delete cycle, assess completeness.

### CRUD completeness per entity
- [ ] Can create every entity type
- [ ] Can list/read every entity type
- [ ] Can update fields after creation
- [ ] Can archive or delete (if domain-appropriate)

### Search and filtering
- [ ] Can find an entity by name or key field (not just list all)
- [ ] List tools support filtering or pagination
- [ ] Dashboard/summary tools exist for overview

### Cross-entity references
- [ ] Related entities can be linked (contact → deal → activity)
- [ ] Listing one entity shows relationships (deals show contact name, not just contactId)
- [ ] Parent-child integrity (deleting parent warns about orphans)

### Common gaps (flag if missing)
- No search tool (only list-all)
- No update tool after creation
- No summary/dashboard
- Write-heavy with no reads (data goes in but can't come out)
- No export capability
- No bulk operations for repeated tasks

## 5. Instructions Quality

Kit instructions are LLM system prompts that shape behavior.

**What to check:**
- [ ] Instructions cover the main 2-3 use cases
- [ ] Behavioral triggers exist: "When the user mentions X, suggest Y"
- [ ] Domain knowledge included (stage names, categories, tax rules)
- [ ] Instructions say "never show internal IDs to the user"
- [ ] Data formatting conventions specified (currency, dates)
- [ ] Tone and interaction style match the target audience

## 6. Error Handling

**What to check:**
- [ ] Missing required params → returns `kit.validationError()` or Zod catches it
- [ ] Invalid ID references → returns `kit.notFound("entity", id)`
- [ ] Business logic errors → returns `kit.error("message")`
- [ ] Conflicts → returns `kit.conflict("message")`
- [ ] No silent failures (returning success when nothing happened)
- [ ] Error messages are actionable ("Contact not found" not "Error")

## 7. View Loaders

If the kit has views, test them:
- [ ] `kitstack call kit_view <id>` lists available views
- [ ] Views load without errors
- [ ] View data matches what tools return (same entities appear)
- [ ] Views handle empty state (no data yet)
