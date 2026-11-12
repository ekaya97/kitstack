---
name: dev-docs
description: Generate comprehensive developer documentation (.mdx) for the KitStack SDK framework. Use this skill when the user wants to write, update, or expand developer-facing documentation — including getting started guides, concept explainers, API references, how-to guides, or example-driven tutorials. Trigger when the user mentions writing docs, creating a docs page, documenting an API, writing a guide, adding a tutorial, or anything related to developer documentation for the SDK or framework. Also trigger when the user asks to document a specific feature, function, or workflow for external developers.
---

# Developer Documentation Generator

You write production-quality developer documentation for the KitStack SDK — the kind of docs you'd find on nextjs.org, supabase.com/docs, or stripe.com/docs. The output is `.mdx` files that a developer can drop straight into a docs site.

## Your Job

When the user asks you to write documentation, you will:

1. **Understand the scope** — what concept, API, or workflow needs documenting
2. **Read the codebase** — examine the actual source code to understand how public interfaces work, what the types look like, and what edge cases exist
3. **Read the internal docs** — check `docs/sdk/` for internal notes that contain implementation details, gotchas, and design decisions
4. **Write the documentation** — produce a complete `.mdx` file following the patterns below

## Before You Write Anything

Always read the relevant source code first. The internal docs in `docs/sdk/` are engineering notes — they contain valuable context about *why* things work the way they do, but they are not the documentation itself. Your job is to translate implementation knowledge into clear, developer-facing content.

Key places to look:
- `packages/sdk/src/` — core SDK source (types, factories, runtime, errors)
- `packages/sdk/views/src/shared/` — client-side hooks
- `kits/` — real-world usage examples (CRM, expense, outreach kits)
- `docs/sdk/` — internal engineering notes

Read the specific files relevant to what you're documenting. Don't guess at API signatures — verify them in the source.

## Page Types

Every doc page falls into one of four categories. The user might ask for a specific type, or you can suggest the right one based on what they want to document.

### 1. Getting Started (Tutorial)

Linear, step-by-step walkthrough. One happy path, no branching. The reader goes from zero to a working result.

**Structure:**
```
# Page Title

One-sentence description of what the reader will build/achieve.

## Prerequisites

What the reader needs before starting (installed tools, accounts, prior knowledge).

## Step 1: [Action verb] ...

Explanation (2-3 sentences max before the code block).

```bash filename="Terminal"
command here
```

Brief note on what happened.

## Step 2: [Action verb] ...

...continue steps...

## Next steps

- [Link to concept page for deeper understanding]
- [Link to related guide]
```

**Rules:**
- Every step starts with an action verb (Create, Install, Configure, Add)
- Code block before prose explanation — developers scan for code first
- Every code block has a `filename` label so the reader knows which file to edit
- Assume minimal framework knowledge; spell out every action
- One concept per step — don't combine "create the file AND configure it"

### 2. Concept Explainer

Teaches a mental model. No step-by-step instructions — this is about *understanding*.

**Structure:**
```
# Page Title

2-3 sentence intro: what this concept is and why it matters to the developer.

## How [concept] works

Explain the mental model. Use a concrete analogy if it helps, but don't force one.

## [Sub-concept A]

Focused explanation with a code example showing the concept in action.

```ts filename="src/tools/example.ts"
// minimal example demonstrating the concept
```

## [Sub-concept B]

...

## How [concept A] relates to [concept B]

If this concept connects to others, explain the relationship briefly. Link to their pages.

## Next steps

- [Guide for using this concept in practice]
- [API reference for the underlying functions]
```

**Rules:**
- Show, then explain. Code example first, then walk through what it does.
- Don't mix "what is X" with "how to use X" — that's what guides are for
- Use diagrams (described in MDX comments) where relationships are spatial or hierarchical

### 3. How-To Guide

Task-oriented. The reader has a specific goal and wants to achieve it. Unlike tutorials, guides assume the reader has basic familiarity already.

**Structure:**
```
# How to [achieve goal]

One-sentence description of what this guide covers.

<Note>
This guide assumes you've completed the [Getting Started](/docs/getting-started) tutorial.
</Note>

## [First major task]

```ts filename="src/tools/my-tool.ts"
// complete, working example
```

Explain the key parts. Focus on the *why* behind non-obvious choices.

## [Second major task]

...

## Common patterns

Show 2-3 variations developers commonly need.

## Gotchas

<Warning>
Specific pitfall and how to avoid it.
</Warning>

## Next steps

- [Related guide]
- [API reference]
```

**Rules:**
- Start from a realistic scenario, not an abstract one
- Every code block must be copy-paste ready (or have clearly marked placeholders like `your-kit-id`)
- Surface gotchas in `<Warning>` callouts — these are gold for developers
- Link to the API reference for functions used, don't duplicate the full signature

### 4. API Reference

Exhaustive documentation for a single function, type, or module. Terse, scannable, complete.

**Structure:**
```
# functionName()

One-sentence description.

## Signature

```ts
function functionName(param: Type): ReturnType
```

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `param` | `Type` | Yes | What this parameter does |
| `options.field` | `Type` | No | What this field controls. Default: `value` |

## Returns

`ReturnType` — description of what's returned.

## Examples

### Basic usage

```ts filename="kit.config.ts"
// minimal working example
```

### With options

```ts filename="kit.config.ts"
// example showing optional parameters
```

## Notes

- Edge case or implementation detail worth knowing
- Related: [`otherFunction()`](/docs/api/other-function)
```

**Rules:**
- Every parameter documented, every return type documented
- Default values shown in the parameter table
- At least two code examples: basic and advanced
- Types copied from actual source code, not approximated

## MDX Patterns

Use these components consistently across all pages:

### Callouts

```mdx
<Note>
Helpful context that isn't critical but saves the reader time.
</Note>

<Tip>
A better way to do something, or a shortcut the reader might not know.
</Tip>

<Warning>
Something that will cause bugs, data loss, or confusion if ignored.
</Warning>

<Danger>
Something that will break production, corrupt data, or cause security issues.
</Danger>
```

Use callouts sparingly — if every other paragraph is a callout, none of them stand out. Reserve `<Danger>` for genuine production risks.

### Code Blocks

Always include a filename:

````mdx
```ts filename="src/tools/add-contact.ts"
export const addContact = defineTool({
  name: 'add_contact',
  // ...
})
```
````

Use line highlighting to draw attention to the important part:

````mdx
```ts filename="src/tools/add-contact.ts" highlight={3}
export const addContact = defineTool({
  name: 'add_contact',
  description: 'Add a new contact to the CRM', // highlight the key line
  // ...
})
```
````

Use `filename="Terminal"` for shell commands:

````mdx
```bash filename="Terminal"
kitstack dev
```
````

### Tabs

Use for showing alternatives (e.g., with/without Drizzle, different patterns):

```mdx
<Tabs items={["With Drizzle", "Raw SQL"]}>
<Tab>
```ts filename="src/schema.ts"
// Drizzle version
```
</Tab>
<Tab>
```sql filename="migrations/001.sql"
-- Raw SQL version
```
</Tab>
</Tabs>
```

### Steps

For sequential instructions within a guide:

```mdx
<Steps>

### Create the tool file

```ts filename="src/tools/my-tool.ts"
// code
```

### Register it in your kit config

```ts filename="kit.config.ts"
// code
```

### Test it locally

```bash filename="Terminal"
kitstack dev
```

</Steps>
```

## Writing Style

### Voice and tone

- **Direct and confident.** Say "Create a file" not "You might want to create a file."
- **Second person.** "Your kit" not "the kit." "You define tools" not "tools are defined."
- **Present tense.** "This function returns" not "This function will return."
- **No filler.** Cut "basically", "simply", "just", "actually", "in order to." If something *is* simple, the code shows it.

### Code examples

Every code example must be:
- **Real.** Use actual SDK functions with correct signatures — verify against source code
- **Minimal but complete.** Show the smallest working version, not a kitchen-sink demo
- **Runnable.** A developer should be able to copy it, adjust the obvious placeholders, and have it work
- **Annotated where non-obvious.** Use inline comments only for the parts that need explanation. Don't comment `// import the module` above an import statement.

Generate example code based on patterns you observe in the existing kits (`kits/crm`, `kits/expense`, `kits/outreach`). These are real-world usage — mirror their style.

### Headings

- Every H2 should be scannable — a developer skimming the sidebar should know if this page has what they need
- Use phrases, not single words. "Defining tool arguments" not "Arguments"
- Don't number headings — the TOC handles ordering

### Links

- Link to related pages on first mention of a concept
- API references link to the relevant function page
- Guides link back to the concept they apply
- Use relative paths: `[defineKit()](/docs/api/define-kit)`

## Gotcha Extraction

One of your most valuable contributions is surfacing gotchas — the things that bite developers who are new to the framework. When reading the codebase and internal docs, actively look for:

- **Constraints that aren't obvious from the types.** E.g., tool names must be snake_case, descriptions must be ≥10 chars
- **Environment-specific behavior.** E.g., `console.log()` corrupts stdio transport in dev mode
- **Common mistakes.** E.g., forgetting to use `IF NOT EXISTS` in migrations, or not understanding that `reset()` doesn't re-run migrations
- **Non-obvious defaults.** E.g., absence of `checkAuthz` means "permit all"
- **Build/deploy surprises.** E.g., view shell is pre-generated and requires a restart to update

Surface these in `<Warning>` callouts at the point in the docs where the developer would encounter them.

## Output

Write the complete `.mdx` file content. Ask the user where they want it saved — suggest a path based on the docs structure convention (e.g., `docs/pages/guides/defining-tools.mdx`).

If the user asks for multiple pages, suggest an ordering and write them one at a time so they can review each before moving on.
