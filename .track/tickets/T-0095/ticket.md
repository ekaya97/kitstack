---
id: T-0095
title: "Security and cost controls for kit Lambdas"
status: done
priority: critical
created: "2026-04-27T13:28:06Z"
created_by: human
claimed_by: null
claimed_at: null
labels:
  - security
  - infrastructure
  - lambda
branch: null
files: []
depends_on: []
---

## Description

Hard limits and kill switch for kit Lambda execution. No UX considerations — conservative defaults to prevent cost runaway before inviting testers.

## Current state

- Kit Lambdas are sandboxed (CloudWatch Logs only IAM, DB proxy pattern, 60s invocation tokens)
- Rate limiting: 120 req/min per user, DynamoDB-backed, FAILS OPEN
- Timeout: 30s, Memory: 256MB, Reserved concurrency: NONE
- Outbound internet: UNRESTRICTED

## Changes required

### 1. Lambda hardening (deploy-lambda.ts)
- Timeout: 30s → 10s
- Memory: 256MB → 128MB
- Reserved concurrency: 5 per kit Lambda

### 2. Kill switch (new infra)
CloudWatch alarm on Lambda Invocations (1-min resolution, sum across all Kit-* functions). Threshold: 500 invocations/minute. Second alarm on ConcurrentExecutions > 20. Both trigger SNS → kill Lambda that sets concurrency to 0 on McpRouter + all Kit-* functions. Manual recovery required.

### 3. Rate limiting fixes (handler.ts)
- Fail CLOSED on DynamoDB error (reject request, not allow)
- Per-kit daily invocation cap (500/day per kit per user)
- Circuit breaker: 3 consecutive errors from a kit Lambda → disable for 5 minutes

### 4. Network lockdown
- Move kit Lambdas to VPC with NO NAT gateway (kills outbound internet)
- Or: security group with deny-all outbound
- Kit handlers only need Lambda-to-Lambda invoke (DB proxy), no internet

### 5. AWS Budget backup
- Budget alarm at $20/day as a secondary catch-all
- Alert via email, no auto-action (kill switch handles the fast path)

## Testing strategy

Every control must be verified with absolute certainty before inviting testers.

### Lambda configuration (timeout, memory, concurrency)
Post-deploy assertion script: call `GetFunctionConfiguration` on every `Kit-*` Lambda, assert exact values (timeout=10, memory=128, reservedConcurrency=5). Fail loudly if any value is wrong.

### Kill switch (CloudWatch → SNS → kill Lambda)
- Deploy alarm + kill Lambda
- Manually trigger SNS topic with `aws sns publish`
- Assert: McpRouter concurrency = 0, all Kit-* concurrency = 0, email received
- Manually restore and verify recovery
- Unit test the kill Lambda in isolation with mocked Lambda client
- Cannot test CloudWatch trigger real-time (1-min minimum), but the Lambda itself is a pure function

### Rate limiting (fail-closed, per-kit cap, circuit breaker)
- **Fail-closed:** unit test — mock DynamoDB to throw, assert request rejected (not allowed through)
- **Per-kit daily cap:** unit test — mock counter at 499 (pass), at 500 (reject). Verify DynamoDB TTL for daily rollover
- **Circuit breaker:** unit test — mock kit Lambda returning errors, assert 3rd consecutive error triggers 5-min disable. Assert requests during cooldown rejected. Assert requests after cooldown resume.

### Network lockdown (VPC, no NAT)
- Deploy kit Lambda into VPC
- Test kit tool that attempts `fetch("https://httpbin.org/get")` → must timeout (no outbound)
- Test kit tool that does DB queries via proxy → must work (Lambda-to-Lambda invoke is AWS internal, no NAT needed)
- This is the most critical test — if outbound fails, exfiltration/DDoS/mining is impossible

### Post-deploy verification script (`scripts/verify-security.ts`)
Single script run via `npx sst shell` that checks everything:
```
✓ All Kit-* Lambdas: timeout ≤ 10s
✓ All Kit-* Lambdas: memory ≤ 128MB
✓ All Kit-* Lambdas: reservedConcurrency = 5
✓ Kill switch alarm exists and is OK state
✓ Kill switch SNS topic exists
✓ Kill Lambda exists and has correct permissions
✓ Rate limit fail-closed: DynamoDB error → request rejected
✓ McpRouter rate limit: 120 req/min
✓ Kit-* Lambdas in VPC (when implemented)
✓ Kit-* Lambdas cannot reach internet (when implemented)
```
**Gate:** this script must pass before any tester is invited.

## Implementation order

1. Lambda hardening (timeout, memory, concurrency) — smallest change, immediate protection
2. Rate limit fail-closed — one-line fix, highest impact
3. Kill switch — new infra, critical cost protection
4. Circuit breaker + per-kit cap — router logic
5. VPC lockdown — most complex, biggest security impact
6. Verification script — final gate

## Work Log