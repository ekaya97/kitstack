---
id: T-0197
title: "SDK v0.2 KitContext contract with identity and session"
status: done
priority: critical
created: "2026-09-16T16:50:21Z"
created_by: human
claimed_by: 01a0ab37-154d-7000-bb52-7048ad18423b
claimed_at: "2026-09-16T17:16:34Z"
labels:
  - beta-plan
  - W1
  - G1
branch: agent/01a0ab37-sdk-context
files: []
depends_on:
  - T-0196
---

## Description

Plan: .track/docs/kitstack-beta-execution-plan.md W1-T1. Review: .track/docs/kitstack-beta-execution-plan-review.md §3.2, §3.3, §8 decisions 1-2.

## Goal
Every capability enters a tool through one SDK-owned, request-scoped context.

## Contract
KitContext = { db: StorageBinding, connectors: ConnectorRegistry, identity: RequestIdentity, channel: ChannelContext, session: { id, traceId, parentId? }, telemetry: TelemetrySink, audit: AuditSink, log: Logger }.
RequestIdentity = { principal, actor, delegation? } is frozen here; W3 only adds producers. Instructions and memory stay as composed capabilities (DebriefCapabilities pattern), not context fields.

## Decision
Hard break at SDK 0.2.0: defineTool handler becomes (ctx, args). No shim.

## Acceptance
- Types live in packages/sdk; no kit imports router internals for context.
- identity/channel/session/audit/telemetry are request-scoped and tested as such.
- The debrief host adapts its plugins to the new context without changing kit policy.
- W0-T2 baseline counts do not decrease.

## Write scope
packages/sdk/src/types.ts, define-tool.ts, define-loader.ts, runtime, server adapters; kits/debrief host adapter; SDK tests.

## Work Log
### [2026-09-16T17:16:34Z] 01a0ab37-154d-7000-bb52-7048ad18423b
Shared SDK context contract implementation delegated; integration waits for package tests and maintained-kit migration.
### [2026-09-16T17:24:16Z] 01a0ab37-154d-7000-bb52-7048ad18423b
Shared SDK portion complete in shared tree: context.ts, hard-break handler/load/loader signatures, adapters, devkit, build, CLI templates, test harness. SDK 17 files/178 tests, typecheck and build pass. Kit migration remains in T-0198 continuation before ticket close.
### [2026-09-16T17:46:08Z] codex
Integrated as ff69fcb plus debrief context migration 742f990. SDK typecheck/build pass; full workspace gate remains green at 561 tests after trace slice. Context now includes params for View loaders. Maintained-kit cleanup is tracked separately in T-0198.
### [2026-09-26T00:00:00Z] project-manager
Closed after reconciliation: request-scoped context, identity, session, storage, connectors, telemetry, and audit seams are present on `f4c9f5f`; maintained-kit migration was completed by T-0198.
