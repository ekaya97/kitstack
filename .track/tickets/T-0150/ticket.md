---
id: T-0150
title: "Build kits/debrief sales session and tools"
status: done
priority: critical
created: "2026-09-14T20:53:38Z"
created_by: human
claimed_by: agent-confucius
claimed_at: "2026-09-14T21:25:41Z"
labels:
  - sales-voice
  - debrief
  - dogfood
branch: demo-sales-voice-agent
files: []
depends_on: []
---

## Description

S-01/S-02/S-03. Depends on O-01, P-03, M-01, M-02, and C-02. Create kits/debrief, not kits/sales. Implement prepare_debrief, get_session, get_debrief, confirm_debrief, and teach_from_correction against synthetic data. State machine: prepared -> calling -> awaiting_confirmation -> confirmed; awaiting_confirmation -> partial on incomplete/uncertain confirmation; partial -> confirmed after explicit correction/teach; any provider/start error -> failed. One session ID spans chat, voice, feedback, and UI. Keep the voice loop specialized, not generic defineAgent. Route text extraction/read-back inference through the proxy app identity.

## Work Log
### [2026-09-14T21:15:46Z] project-manager
Launched Peirce on kits/debrief plus packages/demo/src/debrief; specialized stateful workflow, structured teach/replay, proxy-injected text inference, no runtime/http overlap.
### [2026-09-14T21:20:03Z] project-manager
Previous worker stalled with no files; reissued as minimal test-first implementation to Tesla, same disjoint kits/debrief and packages/demo/src/debrief scope.
### [2026-09-14T21:22:48Z] project-manager
Second replacement split T-0150A to Zeno: demo session service only; SDK kit definition will follow as T-0150B after service review.
### [2026-09-14T21:25:41Z] project-manager
T-0150A service is green in eaadd25. Reassigned remaining kits/debrief SDK artifact only to Confucius as T-0150B; no demo service overlap.
### [2026-09-14T21:29:46Z] project-manager
PM integrated eaadd25 service plus 4d5e5b5 kits/debrief SDK definition; package TypeScript passed and demo suite 48/48 passed. Kit exposes exactly five tools with injected handler seam.
