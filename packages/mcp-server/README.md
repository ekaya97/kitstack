# KitStack MCP router

The router exposes every kit to an MCP client through two static tools. It
owns OAuth, identity, dispatch, audit, and View shells. Kits own behavior.

## The onion pattern

`tools/list` returns exactly two tools, `kit` and `kit_view`, and never
changes. Activating or deactivating a kit is reflected the next time the model
calls `kit()`, not through `notifications/tools/list_changed`, which most
clients handle poorly or not at all. Tool selection also degrades above a few
dozen tools; the onion keeps the top-level count at two regardless of how many
kits or actions exist.

Behavior is inferred from which parameters are present, like a CLI:

```
kit()                                          -> list kits this identity may use
kit(id="crm")                                  -> discover actions, with complexity hints
kit(id="crm", cmd="add_contact")               -> describe: schema plus instructions
kit(id="crm", cmd="add_contact", params={...}) -> run
kit_view(id="crm")                             -> list Views
kit_view(id="crm", view="pipeline")            -> render a View in chat
```

A call with no `params` routes to describe and returns the tool's schema and
instructions. A partially filled call that fails validation currently returns
a Zod error string; routing that failure back through describe, so a tool
teaches its use instead of scolding, is planned once the dispatch core exists
and can land in one place.

### Layers

```
Layer 0: tools/list           -> { kit, kit_view }. Static.
Layer 1: kit()                -> activated kits with IDs, names, action counts
Layer 2: kit(id)              -> actions in a kit, marked simple or requires params
Layer 3: kit(id, cmd)         -> parameter schema and instructions for one action
         kit(id, cmd, params) -> execute
```

Minimum path is two calls when the model already knows the kit ID. Full path
is four for an unfamiliar action.

### Why one tool, not many

- LLMs are trained on CLI ergonomics: short parameter names, behavior from
  presence, terse descriptions. First-shot comprehension is better.
- No action enum. Fewer parameters to fill means fewer mistakes.
- Structured JSON params, not a command string. Schema validation stays
  intact and there is no parser to maintain.
- The `kit()` description is a table of contents shaped for the caller. The
  model recognizes instead of searching, which is cheaper than deferred tool
  loading over a catalogue.

## Request lifecycle

```
Bearer JWT  -> verifyAccessToken -> { sub: userId }
            -> rate limit (per user, DynamoDB counter)
            -> protocol handler: initialize | tools/list | tools/call
            -> kit-handler: list | discover | describe | run
            -> tool-dispatcher: resolve kit -> platform adapter -> invoke
            -> audit (tool, kit, duration, outcome; no payloads)
```

The platform adapter resolves a kit to its execution target. Registry kits
invoke a kit Lambda with the caller's per-user database credentials. The
`debrief` kit is a **virtual kit**: the adapter short-circuits `executeTool`,
`executeLoader`, and `getShellHtml` for it and forwards the call to the voice
host over a short-lived internal-signed JWT carrying `{ sub, org, kit, req,
trace, exp }`. An unavailable host maps to a useful MCP error rather than a
generic Lambda failure.

## OAuth

The router is an OAuth 2.1 authorization server with PKCE and dynamic client
registration:

```
POST /register                 -> client_id, client_secret (30-day TTL)
GET  /authorize                -> validate client, redirect to login
GET  /authorize/callback       -> authorization code (10-min TTL)
POST /token                    -> access JWT (1 h) + rotating refresh token
```

Claude Web, Claude Code, and other MCP clients connect once and see every kit
the identity may use. Protected Resource Metadata and Entra federation are
planned; see the roadmap.

## Directory structure

```
src/
  router/
    handler.ts            Lambda entry: OAuth routes, auth, rate limit, dispatch
    mcp-protocol.ts       JSON-RPC: initialize, tools/list, tools/call
    kit-handler.ts        list | discover | describe | run
    tool-dispatcher.ts    resolves a tool call to an execution target
    platform-adapter.ts   registry kits via Lambda; virtual debrief kit via signed bridge
    kit-resources.ts      per-kit resources
    app-resources.ts      View shell and CDN CSP metadata
    app-token.ts          short-lived tokens for View iframes
    authz.ts, audit.ts    tuple checks and audit records
    oauth/                authorize, token, register, metadata, helpers
    oauth-store.ts        DynamoDB-backed OAuth state with TTLs
  app-data/               data endpoint for View iframes
  db/                     registry access and per-user database provisioning
  relay/                  kitstack dev relay
  kill-switch/            emergency disable
  scripts/                seed-registry and deployment helpers
```

## Relationship to `serve()`

`@kitstackco/sdk/server` ships `serve()`, a self-host runtime that speaks the
same two-tool protocol over stdio or HTTP. Today the router and `serve()`
implement dispatch separately, and `serve()` performs no authorization beyond
identity. Extracting one governed dispatch function that both paths call is the
critical-path item on the roadmap; it is what makes self-hosted and hosted
deployments equally governed.
