---
id: T-0217
title: "Declarative model: auto v0 with routing reason"
status: done
priority: medium
created: "2026-09-16T16:50:22Z"
created_by: human
claimed_by: codex
claimed_at: "2026-09-16T20:24:49Z"
labels:
  - beta-plan
  - W9
  - G4
branch: null
files: []
depends_on:
  - T-0205
  - T-0207
---

## Description

Plan: .track/docs/kitstack-beta-execution-plan.md W9-T2. Builds on T-0129 (LLM connector, roadmap decision 3d).

## Scope
models: { conversation, extraction, ... } task-class policy on the LLM connector; every routing decision emitted as telemetry with its reason; cold-start always falls back to the declared policy. No learned routing.

## Acceptance
Debrief text extraction and read-back route through the policy; the FinOps screen shows model per call and the reason.

## Work Log
### [2026-09-16T20:23:29Z] codex
Implemented declarative model routing in 67382ba. SDK policy selects a hand-authored model by task class, uses an explicit/first-entry cold-start fallback, and emits metadata-only model.route telemetry with the selected model and reason. Debrief prebrief extraction now resolves through this policy and writes model/routingReason into FinOps inference telemetry. Focused SDK routing tests 3/3, debrief composition tests 5/5, and SDK build/type declarations pass; voice conversation wiring and learned routing remain open.
### [2026-09-16T20:27:30Z] codex
Completed voice-policy wiring in 5de6a2a. createDemoServer resolves the conversation model through the same declarative router; Twilio/OpenAI bridge and defineAgent lifecycle telemetry carry the routing reason, and realtime inference events expose it to FinOps. Debrief suite passes 31 files / 155 tests with loopback permission; SDK build and routing tests remain green. Learned routing remains intentionally out of scope.
### [2026-09-16T20:28:42Z] codex
Ticket is ready for review after 67382ba SDK routing plus 5de6a2a voice integration. Learned routing remains deliberately deferred; declarative routing and reason telemetry satisfy the beta v0 scope.
### [2026-09-26T00:00:00Z] project-manager
Closed for declarative routing v0. Learned routing remains intentionally out of scope; this is a thin policy wrapper, not an orchestration or model-routing framework.
