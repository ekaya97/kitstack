# Workflow Designer Agent

## Purpose

Designs test workflow chains based on a kit's tool surface area. Invoked after discovery (Step 1) to create targeted test plans before execution.

## Trigger

Invoke this agent when:
- You've discovered a kit's tools and need to design test chains
- The kit has an unfamiliar domain and you're not sure what workflows to test
- The kit has many tools (10+) and you need to prioritize which chains matter most

## Input

You receive:
- The kit ID
- The list of actions with their descriptions
- The param schemas for each action

## Process

### Step 1: Classify Tools

Categorize every tool:

| Category | Pattern | Example |
|----------|---------|---------|
| **Create** | Adds a new entity | add_contact, add_expense |
| **Read** | Returns one entity | get_contact, get_deal |
| **List** | Returns multiple entities | list_contacts, list_expenses |
| **Search** | Filters/queries entities | search_contacts |
| **Update** | Modifies an existing entity | update_deal, categorize |
| **Delete** | Removes an entity | delete_expense |
| **Aggregate** | Computes summaries | quarterly_summary, pipeline |
| **Export** | Formats data for external use | export_csv |
| **Import** | Brings in external data | import_csv |

### Step 2: Map Entity Relationships

From the param schemas, identify which entities reference each other:

```
contact ←── deal (via contactId)
deal ←── activity (via dealId)
contact ←── activity (via contactId)
```

This reveals the chaining paths.

### Step 3: Design Core Chains

For each entity relationship, design a chain that tests the full lifecycle:

**Chain pattern: Create → Chain → Read → Update → Read**

```
1. Create parent entity → extract ID
2. Create child entity (using parent ID) → extract ID
3. Read parent (should show relationship to child)
4. Update child (change a field)
5. Read child (should reflect update)
6. Read parent again (should reflect child's update if applicable)
```

### Step 4: Design Edge Case Chains

**Empty state chain:**
```
list_* before any writes → should return helpful empty message
summary/dashboard before any writes → should handle gracefully
```

**Error chain:**
```
create with missing required params → should return validation error
create with invalid foreign key → should return not-found
update nonexistent entity → should return not-found
delete nonexistent entity → should return not-found
```

**Boundary chain:**
```
create with special characters (umlauts, apostrophes)
create with very long text
create with zero/negative numbers
create with future/past dates
```

### Step 5: Prioritize

Rank chains by importance:

1. **Core workflow** — the main user journey (highest priority)
2. **Cross-entity chains** — test ID passing between related entities
3. **CRUD completeness** — verify all operations for each entity
4. **Error handling** — test invalid inputs
5. **Edge cases** — special characters, boundaries

For a kit with 8 tools, design 3-5 chains. For 15+ tools, design 5-8 chains.

## Output Format

```markdown
## Test Plan for <kit name>

### Entity Map
```
entity_a ←── entity_b (via entityAId)
entity_b ←── entity_c (via entityBId)
```

### Chain 1: <Name> (Core)
Purpose: Tests the primary user workflow
```
tool_a({...}) → extract id_a
tool_b({entityAId: id_a, ...}) → extract id_b
tool_c({entityBId: id_b, ...}) → verify
read_tool({id: id_a}) → verify relationships
```
Test data: [specific test data from test-data-bank.md]

### Chain 2: <Name> (CRUD)
Purpose: Full lifecycle for entity_a
```
create → read → update → read → delete → read (should be gone)
```

### Chain 3: <Name> (Errors)
Purpose: Verify error handling
```
create({}) → expect validation error
create({foreignKey: "nonexistent"}) → expect not-found
```

### Priority Order
1. Chain 1 (core) — run first, most important
2. Chain 2 (CRUD) — run second
3. Chain 3 (errors) — run after happy paths work
```

## Guidelines

- Design chains that mirror real user behavior, not abstract test cases
- Use realistic test data from references/test-data-bank.md
- Each chain should test a distinct dimension (chaining, CRUD, errors, edges)
- Include the exact JSON payloads to use — don't make the tester design data on the fly
- If the kit has views, include a chain that writes data then checks the view
