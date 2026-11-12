---
id: T-0199
title: "Dispatch core shared by serve() and the router, with manifest passthrough"
status: done
priority: critical
created: "2026-09-16T16:50:21Z"
created_by: human
claimed_by: codex
claimed_at: "2026-09-16T18:09:22Z"
labels:
  - beta-plan
  - W2
  - G1
branch: null
files: []
depends_on:
  - T-0197
---

## Description

Plan: .track/docs/kitstack-beta-execution-plan.md W2-T1. Review: .track/docs/kitstack-beta-execution-plan-review.md §3.4, §8 decision 3.

## Goal
One function governs every tool call: dispatch({ identity, actor, delegation, channel, kitId, command, args }) -> resolve -> identity -> grant -> policy -> mode gate -> invoke -> telemetry + audit.

## Scope
- Extract from packages/mcp-server tool-dispatcher/protocol and packages/sdk local adapter into one SDK-owned core; router and serve() become transports over it.
- serve() must pass checkAuthz; authorization hooks cannot be skipped in self-hosted mode.
- Manifest-based passthrough: a registered MCP server with a small manifest maps kit(<server> <tool>) onto a plain tools/call.
- Stable error codes for unknown kit/tool, missing grant, policy denial, provider failure.
- The envelope is channel-agnostic. Accepted at G1 on MCP tool and loader calls, the HTTP trigger, and the debrief scheduler's internal invocation. W5 tickets add voice, job, and proxy conformance tests.

## Acceptance
Dispatch-core tests run against both the serve() adapter and the router adapter with identical outcomes; a call with no grant is denied on both paths.

## Write scope
packages/sdk/src/runtime, server/adapters, server/protocol; packages/mcp-server/src/router/tool-dispatcher.ts, mcp-protocol.ts, platform-adapter.ts; kits/debrief transports.

## Work Log
### [2026-09-16T18:09:23Z] codex
Integrated SDK dispatch core into localAdapter in 7ee986b: serve()/local execution now uses channel-neutral envelope, validation, grant checks, request session propagation, and normalized error codes. Added 3 dispatch pipeline tests; SDK suite 18 files/181 tests and typecheck pass. Router adapter parity and MCP/HTTP/scheduler conformance remain open.
### [2026-09-16T18:17:14Z] codex
Verification checkpoint after 7ee986b: npm run test:all passes across all five gates, 561 tests total (debrief 137, SDK 181, MCP 80, authz 64, web 102). README count refreshed in eef3428. T-0199 remains open pending router adapter parity and conformance coverage.
### [2026-09-16T18:26:53Z] codex
Integrated router parity in f0f34c6: remote tool calls now build the SDK dispatch envelope and pass through resolve -> grant/identity -> circuit/daily policy -> Lambda invoke, with stable error categories, session/trace propagation, and existing audit/cap behavior preserved. MCP focused suite passes 11 files/88 tests. Remaining conformance: loaders, HTTP triggers, scheduler, and manifest validation/passthrough.
### [2026-09-17T06:54:31Z] codex
Partial slice: added provider-neutral SDK MCP manifest contract in manifest.ts, validation for data-only server/tool metadata, and resolveMcpPassthrough() mapping kit(server, tool, args) to native tools/call while preserving tool schemas. Focused test 3/3 and SDK build pass. Router registration and loader/HTTP/scheduler conformance remain open; ticket stays in-progress.
### [2026-09-17T06:57:20Z] codex
Extended the slice with withMcpServers() and serve({ mcpServers }) registration. Registered manifests appear as ResolvedKit entries; executeTool forwards native tools/call with user context, while SDK-built kits delegate to the base adapter. Manifest focused tests 4/4 and SDK build pass. Cloud router registration plus loader/HTTP/scheduler conformance remain open.
### [2026-09-17T07:59:57Z] codex
Completed T-0199. 0588b19 adds loader request/session/trace context through protocol, kit/view routers, local adapter dispatch, cloud adapter, and MCP protocol; adds cloud platform MCP manifest registration parity and conformance tests. Existing HTTP and schedule trigger envelopes plus debrief scheduler job dispatch were verified. Final serialized npm test passes 651 tests: debrief 155, SDK 224, MCP 98, authz 64, web 105, operations 5. SDK build passes; known standalone MCP tsc issues remain pre-existing SST/JSX/config errors.
### [2026-09-26T00:00:00Z] project-manager
Closed at `f4c9f5f`: local and router dispatch share the SDK core, manifest passthrough and loader/HTTP/schedule/debrief conformance are integrated. Remaining authz wiring is isolated in T-0226.
