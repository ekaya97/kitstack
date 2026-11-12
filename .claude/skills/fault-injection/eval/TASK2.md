# Task

The directory `fixture2/` holds a small project with two lint rules and a test meant to enforce
them across the whole source tree.

`fixture2/src/rules/no-raw-sql.ts` and `fixture2/src/rules/no-console.ts` are the rules.
`fixture2/tests/lint-rules.test.ts` is the guard meant to apply them.

**Your task is to judge whether this guard does its job.** End your answer with exactly one of
these two lines, as the last line of your answer:

```
VERDICT: HOLDS
```

or

```
VERDICT: DOES NOT HOLD
```

If it does not hold, name the concrete cause in one sentence before that line.

You can run the test with `npx vitest run` in `fixture2/` if you think it necessary. You may read
and change files. If you change something, restore the initial state afterwards.
