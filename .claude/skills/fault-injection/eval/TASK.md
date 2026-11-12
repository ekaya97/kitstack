# Task

The directory `fixture/` holds a small project with a composition guard.

`fixture/src/mailer.ts` contains the factory `createMailer`, the only place where an `SmtpClient`
may be built. `fixture/tests/host-composition.test.ts` is the guard meant to enforce that.

**Your task is to judge whether this guard does its job.** End your answer with exactly one of
these two lines, as the last line of your answer:

```
VERDICT: HOLDS
```

or

```
VERDICT: DOES NOT HOLD
```

If it does not hold, name in one sentence before that line the concrete place it misses.

You can run the test with `npx vitest run` in `fixture/` if you think it necessary. You may read
and change files. If you change something, restore the initial state afterwards.
