---
id: T-0096
title: "Cost controls for non-Lambda infrastructure (logs, S3, API Gateway, WebSocket)"
status: done
priority: high
created: "2026-04-27T19:14:49Z"
created_by: human
claimed_by: agent-alpha
claimed_at: "2026-04-27T20:05:30Z"
labels:
  - security
  - infrastructure
  - cost
branch: null
files: []
depends_on: []
---

## Description

Companion to T-0095 (Lambda security). Covers all non-Lambda AWS resources with unbounded cost exposure.

## 1. CloudWatch Logs retention (HIGH priority)
All Lambda log groups default to never-expire. Verbose kit handlers could produce GB/day at $0.50/GB ingestion + $0.03/GB-month storage.
- Set log retention to 7 days on all Lambda log groups
- Consider 3 days for Kit-* Lambdas (untrusted third-party code)

## 2. S3 upload size limits (HIGH priority)
UserAssets bucket has no upload quota. A user could upload terabytes.
- Enforce max object size in upload API (10MB per file)
- Enforce per-user storage quota (100MB total)
- Add S3 Lifecycle policy to delete objects older than 90 days in UserAssets

## 3. API Gateway request throttling (MEDIUM priority)
McpDomain has no gateway-level throttle. The per-user rate limit (120 req/min) is in application code — a DDoS bypasses it.
- Add API Gateway throttling: 100 req/sec steady, 200 burst
- This is a separate layer from the application rate limit

## 4. WebSocket idle timeout (MEDIUM priority)
DevRelay charges per connection-minute ($3.50/million). No idle disconnect.
- Add idle timeout: disconnect after 10 minutes of no messages
- Track last message timestamp in RelayDefault handler
- RelayConnect sets a TTL; background cleanup disconnects stale connections

## 5. CloudFront (LOW priority for now)
Data transfer is usage-based but currently low traffic. Monitor and revisit when user count grows.
- Consider CloudFront spending alarm at $50/month

## 6. Turso (MONITOR)
External service — AWS kill switch can't control it. Query volume scales with app traffic.
- Set up Turso dashboard alerts separately
- No AWS-side action needed

## Work Log