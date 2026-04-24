# KitStack MCP Server

MCP server that exposes multiple tool kits to LLMs via the Model Context Protocol.

## Architecture: The Onion Pattern

The server uses a single static tool (`kit`) to progressively disclose capabilities. This avoids the `tools/list_changed` notification problem entirely — the MCP tool list never changes, and kit activation/deactivation is reflected dynamically at the application layer.

### Why

MCP clients must re-query `tools/list` when tools change. Most clients handle `notifications/tools/list_changed` poorly or not at all. By keeping `tools/list` permanently static (1 tool), we sidestep the problem. The LLM discovers available kits by calling `kit()` — a normal tool call, not a protocol event.

Additionally, LLM tool selection degrades above ~30-40 tools. The onion pattern keeps the top-level tool count at 1 regardless of how many kits or actions exist.

### The `kit` Tool

Behavior is inferred from which parameters are present, like a CLI:

```
kit()                                          -> list activated kits
kit(id="crm")                                  -> discover actions in a kit
kit(id="crm", cmd="add_contact")               -> describe an action's parameter schema
kit(id="crm", cmd="add_contact", params={...}) -> run an action
```

The tool definition returned by `tools/list`:

```json
{
  "name": "kit",
  "description": "KitStack — persistent tool kits for AI. Works like a CLI:\n\n  kit()                    -> list available kits\n  kit(id)                  -> show actions in a kit\n  kit(id, cmd)             -> describe an action's parameters\n  kit(id, cmd, params)     -> run an action\n\nStart with kit() to see what's installed.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "id":     { "type": "string", "description": "Kit ID, e.g. 'crm'" },
      "cmd":    { "type": "string", "description": "Action name, e.g. 'add_contact'" },
      "params": { "type": "object", "description": "Action parameters" }
    }
  }
}
```

### The Four Layers

```
Layer 0: tools/list        ->  Always returns just { kit }. Static. Never changes.
Layer 1: kit()             ->  Lists activated kits with IDs, names, action counts.
Layer 2: kit(id)           ->  Shows all actions in a kit with complexity hints.
Layer 3: kit(id, cmd)      ->  Shows the full parameter schema for one action.
        kit(id, cmd, params) -> Executes the action.
```

### Routing Logic

In `mcp-protocol.ts`, tool calls to `kit` are routed by param presence:

```
if (!id)                  -> listKits(userId)
if (id && !cmd)           -> discover(kitId)
if (id && cmd && !params) -> describe(kitId, cmd)
if (id && cmd && params)  -> run(kitId, cmd, params) -> dispatchToolCall()
```

### Typical LLM Interaction

**User says:** "Add a contact named John to my CRM"

```
LLM -> kit()
       "You have 3 kits: crm, expense, meeting"

LLM -> kit(id="crm")
       "11 actions: add_contact (simple), add_deal (requires params), ..."

LLM -> kit(id="crm", cmd="add_contact", params={ name: "John" })
       "Contact added: John (id: 42)"
```

The LLM skipped `describe` because `discover` marked `add_contact` as simple. For actions marked "requires params", the LLM would call `kit(id, cmd)` first to see the schema.

**Minimum path:** 2 calls (kit -> kit with cmd+params) when the LLM already knows the kit ID.
**Full path:** 4 calls (kit -> kit(id) -> kit(id,cmd) -> kit(id,cmd,params)) for unfamiliar complex actions.

### Entitlement

`kit()` only returns kits the user has activated. Entitlement is checked via `UserKitDbItem` records in DynamoDB. When a user activates or deactivates a kit through the dashboard, it's immediately reflected the next time the LLM calls `kit()` — no protocol notifications needed.

### Why Not Flat Mode

Previously the server had two modes:
- **Flat mode** (<=40 tools): list all tools individually via `tools/list`
- **Onion mode** (>40 tools): collapse into per-kit meta-tools

This was removed because:
1. Flat mode requires `tools/list` to change when kits are activated/deactivated
2. The mode switch created two code paths to maintain
3. The single `kit` tool is simple enough that the extra tool call cost is negligible

## Directory Structure

```
src/
  framework/         Core types, DynamoDB access, kit/tool definition helpers
    types.ts         KitToolInput, KitRegistryItem, UserKitDbItem, etc.
    dynamo.ts        DynamoDB operations for registry and user kit DBs
    define-kit.ts    defineKit() helper for kit authors
    define-tool.ts   defineTool() helper for kit authors
    db-provisioner.ts  Turso database provisioning per user per kit
    audit.ts         Audit logging

  router/            MCP protocol handling
    handler.ts       Lambda entry point: OAuth, auth, rate limiting, routing
    mcp-protocol.ts  MCP JSON-RPC dispatch: initialize, tools/list, tools/call
    kit-handler.ts   The onion layer handlers: list, discover, describe, run
    tool-dispatcher.ts  Resolves a tool call to a kit Lambda invocation

  kits/              Kit implementations (each is a separate Lambda)
    crm/             CRM kit: contacts, deals, pipeline, proposals
    expense/         Expense & tax prep kit
    meeting/         Meeting action tracker kit
    outreach/        Outreach kit

  scripts/           Deployment helpers
    seed-registry.ts Populates DynamoDB registry from kit definitions
```

## Key Design Decisions

- **CLI-style interface.** LLMs are heavily trained on bash/CLI interactions. The `kit` tool mimics CLI ergonomics: short param names (`id`, `cmd`), behavior driven by param presence, terse descriptions. This improves first-shot comprehension.

- **No action enum.** Instead of `action: "discover" | "describe" | "run"`, behavior is inferred. Fewer params to fill = fewer mistakes.

- **Complexity hints in discover.** The discover response marks each action as "simple" or "requires params" so the LLM can skip the describe step for trivial actions.

- **One tool, not two.** We considered separate `list_kits` + `use_kit` tools. A single `kit` tool is terser, has one schema to learn, and maps naturally to the CLI mental model (`git` with subcommands, not `git-add` / `git-commit` as separate binaries).

- **No string parsing.** Despite the CLI inspiration, params are structured JSON — not a command string to parse. This keeps MCP schema validation and avoids building a parser.
