# Durable project knowledge

All of `.track/` is tracked in git, decided on 2026-11-12. That covers decisions, specs, plans,
findings, release notes, tickets and the board. Knowledge nobody can commit dies with the laptop,
and that includes the work log. Half the value of a ticket is knowing which roads were already
walked.

The repository `ekaya97/kitstack` is public. Everything in here is published the moment it is
pushed. The rules below apply to every file in this tree, not only the curated ones.

## What goes where

| Folder | Holds |
| --- | --- |
| `.track/adr/` | Decisions, numbered, never rewritten. Supersede rather than edit. See `adr/README.md`. |
| `.track/specs/` | How a subsystem or kit is meant to work. The intended behavior, not the code. |
| `.track/plans/` | Approved plans, current and historical, so the next session can pick them up. |
| `.track/findings/` | Measured results and the conclusions drawn from them, dated. Including the wrong ones. |
| `.track/releases/` | One release note per version, `vX.Y.Z.md`, written for a developer who installs the SDK. |
| `.track/tickets/` | Operational work items. They die with the work. See `CONVENTIONS.md`. |
| `.track/archive/` | Closed tickets and retired material, kept for history. |

The public developer docs live in `web/content/docs/`, and the SDK contracts in `docs/sdk/`.
`.track/` is internal working knowledge. When a spec here and a published doc disagree, fix both
in the same change.

## The one rule: nothing secret, nothing personal

Nothing in here may carry:

- a secret of any kind. API keys, tokens, auth tokens in a `libsql://` URL, Twilio SIDs and auth
  tokens, OAuth client secrets, private keys, passwords. Name the secret by its SST name or env
  variable instead (`TWILIO_AUTH_TOKEN`, `Resource.TursoToken`).
- a natural person's phone number, email address or home address, including the owner's own.
  Use `<operator email>` or `+49<redacted>` in logs and rehearsal notes.
- a real end user's name, call transcript or recording. The product invariant holds here too.
  Transcripts and audio never reach a tracked file.

Customer and partner organisations may be named. They are businesses, not data subjects.

Sweep for patterns, not for names you already know. On 2026-11-12 the first sweep of this tree
found the owner's email in T-0109 and a mobile number inside a Twilio error in T-0194. A name
search would have found neither. Before a commit that touches `.track/`, grep the staged files
for email, phone (`\+[0-9]{2}[ 0-9]{8,}`), and key shapes (`sk-`, `AKIA`, `ghp_`, `eyJ`,
`authToken=`, `-----BEGIN`). `git add -A` is not a review. Read what is staged.

## Writing a finding

State what was measured, on what, and what it does not establish. A finding with no denominator
is an opinion.

> ~~"The eval harness shows kits beat CRUD."~~
> "On the debrief scenario set (6 scenarios, 2026-11-07), the kit needed 3 round-trips against
> 11 for the CRUD baseline. This does not establish the result for kits without a write path."

Say whether a result comes from unit tests with fake providers or from an operator-controlled
live rehearsal. The two are not interchangeable (CLAUDE.md, Working method).

Record superseded findings rather than deleting them, with a line saying what replaced them.
