---
id: T-0020
title: "Build: manifest with version from defineKit"
status: done
priority: low
created: "2026-04-25T15:44:16Z"
created_by: human
claimed_by: agent-oscar
claimed_at: "2026-04-25T16:24:04Z"
labels:
  - build
branch: null
files: []
depends_on: []
---

## Description

The build manifest at .kitstack/build/manifest.json should include the version from defineKit({version}). Currently hardcoded. Also add sdkVersion from the SDK's package.json. Minor but needed for deployment pipeline.

## Work Log