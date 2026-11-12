---
id: T-0143
title: "Delete ignored deprecated tree only"
status: done
priority: high
created: "2026-09-14T20:53:13Z"
created_by: human
claimed_by: agent-codex-t0143
claimed_at: "2026-09-14T20:56:44Z"
labels:
  - sales-voice
  - cleanup
branch: demo-sales-voice-agent
files: []
depends_on: []
---

## Description

C-01a from the reviewed plan. Confirm with rg excluding .next and ignored build output that deprecated/ has zero live consumers, then remove only the ignored deprecated/ tree. Do not touch .track, kits/adint, kits/fressnapf, or active source. Record the deletion and verification command in the ticket log. This is cleanup only and is independent of the demo runtime.

## Work Log
### [2026-09-14T20:56:44Z] agent-codex-t0143
Verified no live consumers before deletion. rg checks excluded deprecated/**, .next/**, web/.next/**, web/.open-next/**, **/node_modules/**, **/dist/**, **/build/**, **/out/**, **/coverage/**, **/.sst/**, **/.kitstack/**, **/databases/**, **/.git/**, **/.track/**, **/*.tsbuildinfo, **/package-lock.json, and **/*.md; searches for deprecated/ and deprecated module/path references returned no matches (rg exit 1). git ls-files deprecated returned 0 tracked files. Deleted only deprecated/ (122 regular files and 22 symlinks including vendored dependency contents). Post-check: deprecated/ absent and git ls-files deprecated remains 0. No active source, .track, kits/adint, or kits/fressnapf files changed.
### [2026-09-14T20:57:29Z] agent-codex-t0143
Correction: the clean verification also explicitly excluded .gitignore. Exact command form used (run for both patterns) was: rg -n --hidden --no-ignore -g '!deprecated/**' -g '!.gitignore' -g '!.next/**' -g '!web/.next/**' -g '!web/.open-next/**' -g '!**/node_modules/**' -g '!**/dist/**' -g '!**/build/**' -g '!**/out/**' -g '!**/coverage/**' -g '!**/.sst/**' -g '!**/.kitstack/**' -g '!**/databases/**' -g '!**/.git/**' -g '!**/.track/**' -g '!**/*.tsbuildinfo' -g '!**/package-lock.json' -g '!**/*.md' -e 'deprecated/' . ; and the second invocation used the same exclusions with -e '(^|/)deprecated($|/)|kit-definitions'. Both returned no matches (rg exit 1).