# SDK Test Plan

## Current Coverage

**34 tests across 2 SDK test files:**
- `packages/sdk/src/testing/createTestKit.test.ts` (11 tests) — in-memory DB, tool invocation, callAs, reset, load-only tools, migration errors
- `packages/sdk/src/runtime/mcp-handler.test.ts` (23 tests) — JSON-RPC protocol, two-tool split, progressive discovery, kit_view embedded resources, __load_view

**MCP server has 11 test files** (router, framework, oauth, app-data) — these are separate from the SDK.

**CRM kit has 1 test file** (`kits/crm/test/tools.test.ts`) — add_contact, list_contacts, list_proposals, deals, activities, validation.

**Other kits have no tests.**

---

## What's Not Tested

### Tier 1: Pure logic, zero dependencies, high value

These are all unit-testable with no mocks needed.

#### 1.1 defineKit validation (`define-kit.ts`)
- Tool name must be snake_case — valid: `list_contacts`, invalid: `listContacts`, `List-Contacts`
- Suggested fix in error message (`listContacts` → `list_contacts`)
- Tool description minimum 10 chars — error for 9, pass for 10
- Tool description > 200 chars — console.warn (not throw)
- Tool name prefixed with kit ID — console.warn
- Duplicate tool names — throws KitValidationError
- Duplicate view slugs — throws KitValidationError
- View slug must be kebab-case — valid: `contact-detail`, invalid: `contactDetail`
- Tool missing both load() and handler() — throws ToolValidationError
- Zod args missing .describe() — console.warn

#### 1.2 Result helpers (`result.ts`)
- `kit.text("hello")` → `{ content: [{ type: "text", text: "hello" }] }`
- `kit.error("bad")` → `{ ..., isError: true }`
- `kit.json({ a: 1 })` → text is `JSON.stringify({ a: 1 }, null, 2)`
- `kit.notFound("contact", "abc")` → text contains both, isError true
- `kit.validationError("msg")` → prefixed with "Validation error:"
- `kit.conflict("msg")` → prefixed with "Conflict:"

#### 1.3 Error hierarchy (`errors.ts`)
- KitStackError sets code, docUrl (`https://docs.kitstack.dev/errors/{code}`), name
- Each subclass sets its own name (KitValidationError, ToolValidationError, MigrationError, SchemaError, AuthError)
- instanceof chains work (ToolValidationError instanceof KitStackError)

#### 1.4 defineTool (`define-tool.ts`)
- Load-only tool: defineTool with load, no handler → auto-generates handler returning kit.json(data)
- Handler-only tool: defineTool with handler, no load → returns as-is
- Both load + handler: returns as-is, handler is not overwritten
- TypedToolWithLoad: returned object has .load() with correct types

#### 1.5 Zod to JSON Schema (`runtime/zod-to-json-schema.ts`)
- z.object with required and optional fields
- z.string, z.number, z.boolean → correct JSON Schema types
- z.array(z.string()) → `{ type: "array", items: { type: "string" } }`
- z.enum(["a", "b"]) → `{ type: "string", enum: ["a", "b"] }`
- z.optional wrapping → field not in required array
- z.default → includes default value in schema
- .describe() → propagates to description field
- Nested z.object → recursive property generation
- z.record → additionalProperties

### Tier 2: Needs in-memory DB or filesystem mocks

#### 2.1 createTestKit — authorize hook
- Tool with authorize hook + checkAuthz → allowed call succeeds
- Tool with authorize hook + checkAuthz → denied call returns Forbidden error
- Tool with authorize hook but no checkAuthz → skipped (call succeeds)
- Multiple requirements — all must pass

#### 2.2 createTestKit — loadView
- loadView with valid slug → returns loader data
- loadView with invalid slug → throws Error
- loadView with custom context → ctx override works

#### 2.3 MCP handler — authorize hook
- Handler with checkAuthz configured → evaluates tool.authorize
- Handler without checkAuthz → skips authorize (permissive)
- Multiple AuthzRequirements — first failure returns Forbidden

#### 2.4 Dev database provisioning (`runtime/dev-db.ts`)
- Creates .kitstack directory if missing
- Creates SQLite file and runs migrations
- Reset flag deletes existing DB file before re-provisioning
- Invalid SQL in migrations → throws MigrationError
- Semicolon splitting handles multi-statement SQL

#### 2.5 Credentials (`cli/credentials.ts`)
- saveCredentials writes JSON to ~/.kitstack/credentials.json
- loadCredentials reads and parses the file
- loadCredentials returns null if file doesn't exist
- File permissions are restricted (0600)

### Tier 3: Needs mocks for AWS SDK, HTTP, or filesystem

#### 3.1 Build system (`build.ts`)
- Loads kit.config.ts and validates
- Migration SQL validated against in-memory SQLite
- Server bundle produced by esbuild
- View entry points generated per view
- Vite builds view modules with manualChunks (vendor.js, shared.js)
- Manifest.json generated with tool/view counts, hashes, sizes
- Bundle size warnings emitted at thresholds
- Error: missing kit.config.ts
- Error: invalid migration SQL

#### 3.2 Deploy — S3 upload (`deploy/upload.ts`)
- Uploads views/, shell.html, kit.mjs, manifest.json to correct S3 keys
- Namespaces under `apps/kits/{kitId}/` and `bundles/{kitId}/`
- Sets correct Content-Type per extension
- Sets Cache-Control header
- Skips missing directories gracefully
- Returns correct file count

#### 3.3 Deploy — registry seeding (`deploy/seed-registry.ts`)
- Inserts tools into kit_registry (upsert)
- Inserts views into kit_views (upsert)
- Handles lambdaResource field (null for convention-based)
- Closes client connection in finally block

#### 3.4 Deploy — Lambda provisioning (`deploy/deploy-lambda.ts`)
- Creates new function if not exists (Kit-{kitId} naming)
- Updates existing function code + config
- Waits for function to become active
- Returns created=true for new, created=false for update
- Uses correct runtime (nodejs22.x), architecture (arm64), handler (index.main)

#### 3.5 Auth adapters
- none(): returns userId "anonymous" (or custom), always validates
- kitstack(): validates token against /oauth/userinfo endpoint
- kitstack(): returns proper OAuth metadata
- oauth(): calls custom validate callback
- oauth(): token introspection pattern
- All adapters implement AuthAdapter interface

#### 3.6 CLI commands
- init: creates directory structure matching expected layout
- init: validates kit name (lowercase, no spaces)
- build: calls buildKit with correct working directory
- login: spawns localhost callback server
- login: saves token via saveCredentials
- publish: checks credentials before proceeding
- publish: calls build if no .kitstack/build exists

### Tier 4: Integration / E2E

#### 4.1 Router — kit-resources.ts
- getKitFunctionId returns `Kit-{kitId}` by convention
- Falls back to lambdaResource from registry if present
- getKitAuthzSlug returns `{kitId}-kit`

#### 4.2 Full kit lifecycle (E2E with CRM kit)
- defineKit → buildKit → createTestKit → call tools → verify results
- defineKit → buildKit → manifest has correct structure
- kit_view renders embedded resource with loader data

#### 4.3 Other kit tests (matching CRM pattern)
- Outreach: create_sequence, list_sequences, add_prospect
- Expense: add_expense, list_expenses, import_csv
- Meeting: process_meeting, list_meetings, list_actions

---

## Test Infrastructure

### Current setup
- vitest 2.x with jsdom environment (root config)
- packages/sdk has its own vitest.config.ts (node environment, no jsdom)
- @libsql/client available for in-memory SQLite
- No mocking framework configured (vitest has built-in vi.mock)

### Needed
- AWS SDK mocks for deploy tests (vi.mock @aws-sdk/client-s3, @aws-sdk/client-lambda)
- Filesystem mocks for CLI tests (vi.mock node:fs) or use temp directories
- HTTP mocks for auth adapter tests (vi.mock or msw)
- Coverage reporting (vitest --coverage with v8 or istanbul)

---

## Execution Order

### Phase 1: Foundation (Tier 1 — pure unit tests)
**~60 tests, no mocks needed, can all run in parallel**

| Group | File to create | Est. tests |
|-------|---------------|------------|
| defineKit validation | `src/define-kit.test.ts` | 15 |
| defineTool | `src/define-tool.test.ts` | 8 |
| Result helpers | `src/result.test.ts` | 8 |
| Error hierarchy | `src/errors.test.ts` | 10 |
| Zod-to-JSON-Schema | `src/runtime/zod-to-json-schema.test.ts` | 12 |
| kit-resources | router test (extend existing) | 5 |

### Phase 2: Authorize + Views (Tier 2)
**~25 tests, needs in-memory DB**

| Group | File | Est. tests |
|-------|------|------------|
| Authorize hook (testkit) | extend `createTestKit.test.ts` | 6 |
| Authorize hook (handler) | extend `mcp-handler.test.ts` | 5 |
| loadView | extend `createTestKit.test.ts` | 4 |
| Dev DB | `src/runtime/dev-db.test.ts` | 6 |
| Credentials | `src/cli/credentials.test.ts` | 4 |

### Phase 3: Build + Deploy (Tier 3)
**~45 tests, needs mocks**

| Group | File | Est. tests |
|-------|------|------------|
| Build system | `src/build.test.ts` | 12 |
| S3 upload | `src/deploy/upload.test.ts` | 8 |
| Registry seeding | `src/deploy/seed-registry.test.ts` | 6 |
| Lambda provisioning | `src/deploy/deploy-lambda.test.ts` | 8 |
| Auth adapters | `src/server/auth/adapters.test.ts` | 12 |

### Phase 4: CLI + Kit Tests (Tier 3-4)
**~50 tests**

| Group | File | Est. tests |
|-------|------|------------|
| CLI init | `src/cli/commands/init.test.ts` | 10 |
| CLI build/dev | `src/cli/commands/build.test.ts` | 5 |
| CLI login | `src/cli/commands/login.test.ts` | 8 |
| CLI publish | `src/cli/commands/publish.test.ts` | 8 |
| Outreach kit | `kits/outreach/test/tools.test.ts` | 8 |
| Expense kit | `kits/expense/test/tools.test.ts` | 6 |
| Meeting kit | `kits/meeting/test/tools.test.ts` | 6 |

---

## Coverage Targets

| Area | Current | Target |
|------|---------|--------|
| SDK core (types, define-*, result, errors) | 0% | 90% |
| SDK runtime (mcp-handler, dev-db, zod) | ~60% | 85% |
| SDK testing (createTestKit) | ~80% | 95% |
| SDK build | 0% | 70% |
| SDK deploy | 0% | 75% |
| SDK CLI | 0% | 60% |
| SDK server/auth | 0% | 75% |
| Kit tools (CRM) | ~90% | 95% |
| Kit tools (other 3) | 0% | 80% |
