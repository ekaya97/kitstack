# Vendored skills

Six skills from [mattpocock/skills](https://github.com/mattpocock/skills), MIT licensed
(`LICENSE.mattpocock`). Pulled 2026-09-08 at commit `3cca18b` into the insai repository and
copied from there into kitstack on 2026-11-12.

| Skill | Origin | Pulled because |
| --- | --- | --- |
| `grill-with-docs` | engineering/ | asked for; delegates to the two below |
| `grilling` | productivity/ | `grill-with-docs` calls it |
| `domain-modeling` | engineering/ | `grill-with-docs` calls it |
| `improve-codebase-architecture` | engineering/ | asked for |
| `codebase-design` | engineering/ | asked for |
| `writing-for-agents` | productivity/ | asked for; the basis for `fault-injection` and `write-ticket` |

Upstream is not a submodule, so these do not update themselves. To refresh, re-clone and
re-copy, then read the diff rather than accepting it, and re-apply the local edits below.

## Local edits

- `improve-codebase-architecture/SKILL.md`: the Explore step and the decision sources also name
  the "Architecture rules" in `CLAUDE.md` and the section "What will not be built" in
  `web/content/docs/roadmap.mdx`, because kitstack records its binding decisions there.

## ADRs and the glossary

ADRs live in `.track/adr/` since 2026-11-12, as in insai, with the format and index in
`.track/adr/README.md`. `domain-modeling/SKILL.md`, `domain-modeling/ADR-FORMAT.md` and
`improve-codebase-architecture/SKILL.md` carry a one-line kitstack override to that effect; the
upstream examples that show `docs/adr/` are left as they are. kitstack has no `CONTEXT.md` yet.
`domain-modeling` creates a root `CONTEXT.md` lazily on the first resolved term.

`agents/openai.yaml` in each skill is kept from insai, which drives `codex exec` as well. None of
them references insai.
