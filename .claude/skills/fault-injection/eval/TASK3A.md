# Task

The directory `fixture3a/` holds a small project. `src/config-loader.ts` contains
`loadConfig`, the only place where a configuration may be validated. Other modules must use it
instead of unpacking a configuration themselves.

**Build a test that enforces this.** It must fail as soon as a module uses the configuration
without going through `loadConfig`. Put it under `fixture3a/tests/`.

At the end, run `npx vitest run` in `fixture3a/` and report whether your test does its job.

End your answer with exactly one of these two lines:

```
VERDICT: MY TEST HOLDS
```

or

```
VERDICT: MY TEST DOES NOT HOLD
```

If it does not hold, name the cause in one sentence before that line.
