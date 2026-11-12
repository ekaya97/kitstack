---
name: write-ticket
description: Write a ticket under .track/tickets, or revise one, when its frontmatter is malformed or an agent with no history could not pick it up.
---

# Write a ticket

`.track/` is tracked in git since 2026-11-12, so every checkout and worktree has it. Run `track`
from the checkout you work in. A ticket changed in a worktree reaches other sessions only once
that branch merges into `dev`. The repository is public, so a ticket carries no secret and no
phone number or email (`.track/KNOWLEDGE.md`, "The one rule").

## Steps

1. Create the frontmatter. Create new tickets with `track create` and the options from
   `track create --help`, so the ID and timestamps come from the tool. Pass `--no-claim` when the
   ticket is for someone else. The status values are the lifecycle in
   `.track/CONVENTIONS.md`, section "Ticket Lifecycle".
2. Set the lists. `labels` and `depends_on` are block lists, one item per line, as in
   `.track/tickets/T-0222.md`. Check the written frontmatter with
   `track show T-NNNN`. Example:

   ```yaml
   labels:
     - sdk
     - connectors
   ```

   Pick labels that already exist. Reuse topic labels such as `sdk`, `infra`, `web`, `connectors`
   or `sales-voice`, and list the labels in use with
   `grep -h '^  - ' .track/tickets/*.md | sort | uniq -c | sort -rn`.
3. Write the entry point. Start the body with `## Description` and, under it, `### Read first`.
   List the exact documents in reading order, numbered, each with one sentence on what it gives
   this ticket. Draw them from the source-of-truth list in [CLAUDE.md](../../../CLAUDE.md#source-of-truth-documents).
4. Write the scope and acceptance. Put the work under `## Scope`. Close with `## Acceptance` as a
   checklist. Each condition must be checkable as met or unmet, and together they must cover the
   whole job. A code change names the gate from CLAUDE.md, "Working method", step 5, and says
   whether it needs a provider smoke. Use
   [Steps and completion criteria](../writing-for-agents/SKILL.md#steps-and-completion-criteria).
5. Check the handoff. An agent holding only the ticket must be able to work through the reading
   list and start on the scope. The worktree and branch come from `track claim` and the
   coordinator's brief. Keep concrete worktree paths and branch names out of the body, because
   they go stale.

## Dependencies and private data

Dependencies. `depends_on` names tickets whose status `done` is a precondition for starting.
Check their real state before you claim. A ticket is done when a commit on `dev` has a subject
starting with its ID (`git log --oneline dev | grep T-NNNN`), not when its Work Log says so.

Private data. Keep secrets and personal data out of the ticket. That covers secret values, phone
numbers, email addresses and anything from a debrief call. Read
[CLAUDE.md](../../../CLAUDE.md#environment-and-secrets), "Environment and secrets", for the secret
rule, and "What this is" for the metadata-only telemetry invariant.

Revisions. `.track/CONVENTIONS.md`, rule 4, says to change `.track/` files only
through the `track` CLI. Use `track update` for status, labels and title, and `track log` to add a
Work Log entry. Edit a ticket body by hand only when the user asks for it.
