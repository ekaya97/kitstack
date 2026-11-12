# Architecture Decision Records

One file per decision, numbered, never rewritten. If a decision changes, add a new ADR that
supersedes the old one and mark the old one `superseded by ADR-NNNN`. The point is that the
reasoning survives, including reasoning that turned out to be wrong. Modeled on the insai repo,
introduced on 2026-11-12. See `../KNOWLEDGE.md`, in particular the rule that nothing in this tree
may carry a secret or a person's contact data.

## When to write one

When you catch yourself re-deriving a decision from code, tickets and memory notes. That is the
signal.

Also worth one: anything that looks like duplication but is deliberate, any boundary a future
reader would plausibly "clean up", and any constraint imposed by a third party (the MCP spec,
Twilio, OpenAI Realtime, the 5-VPC limit in `eu-central-1`) that would otherwise look arbitrary.

All three should hold. It is hard to reverse, it is surprising without context, and there was a
real alternative.

## Format

```
# ADR-NNNN — <decision in one line, in the present tense>

- Status: proposed | accepted | superseded by ADR-NNNN
- Date: YYYY-MM-DD
- Deciders: <names>
- Related: <ADRs, tickets, specs>

## Context      — what forced the decision; measurements, not adjectives
## Decision     — what we do, numbered
## Consequences — what this costs, and what it does NOT solve
## Follow-ups   — concrete, checkable
```

Keep Context factual and quantified. "The router is slow" ages badly. "p95 `tools/call` is 840 ms
on 2026-11-07, of which 610 ms is the grant lookup" tells the next reader whether the situation
still holds.

File names are `NNNN-<decision-as-a-slug>.md`. Take the next free number from the index below.

## Index

None yet. The first ADRs record decisions that already govern the code and today live only in
CLAUDE.md, tickets and specs. Candidates include the single `dispatch` path, metadata-only
telemetry, fail-closed auth, the two static MCP tools, forward-only migrations and the voice
service moving from ECS to the Hetzner box.
