---
id: T-0158
title: "Automated two-run sales voice dogfood gate"
status: done
priority: critical
created: "2026-09-15T10:19:24Z"
created_by: human
claimed_by: null
claimed_at: null
labels:
  - sales-voice
  - dogfood
  - observability
branch: null
files: []
depends_on: []
---

## Description

Add an end-to-end local test/script that starts from prebrief, runs simulator voice lifecycle, teaches a correction, publishes memory, verifies retrieval on run two, checks proxy/observability/session trace, and verifies reset repeatability.

## Work Log