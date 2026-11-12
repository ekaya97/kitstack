# Evals for `fault-injection`

Built in the insai repository for its ticket T-0395 and run there on 2026-09-22, when the skill
was still called `eingriff-fahren`. `RESULTS.md` holds the measurement and the conclusion,
including the limitation the evals could not overcome. The ticket numbers in these files refer to
insai tickets and do not exist under kitstack's `.track/`.

## Layout

Each task has a `TASK*.md` with the instruction to the subject and an `ANSWER*.md` with the
correct answer, written **before** the run. The test pieces live under `fixture*/` and were reset
to their initial state after each run.

- `fixture/`, task 1: a composition guard that lists two hosts while a third file builds the
  forbidden construction.
- `fixture2/`, task 2: a guard that filters on `.tsx` while every file ends in `.ts`, so it reads
  zero files.
- `fixture3a/` and `fixture3b/`, task 3: two identical copies. The subject builds the guard and
  then judges its own work. Two copies keep the arms from overwriting each other's test file. In
  the first attempt both ran in the same directory and were stopped before anything happened.

`answers/` holds the guards the two arms built in task 3. They are not part of the test piece and
are not reset before a new run. They are kept as delivered, so their comments still cite
`eingriff-fahren`.

## How to run it

For each task, two fresh agents of the same model with no history. One gets only the `TASK` file.
The other is also told to read `SKILL.md` in full first and to follow it. Neither may open the
`ANSWER` files.

The test pieces need `zod` and `vitest`. In both arms, task 3 ran only after the agent installed
the dependencies itself. That is part of the task, not a defect.

No kitstack test or typecheck glob reaches this directory. The workspace vitest configs include
only their own `src/`, `test/` or `tests/`, the root `tsconfig.json` does not include `.claude/`,
and `.claude/` is git-ignored.

## What should change next time

All three tasks present checking as **the** task. The cases the skill came from looked different.
There the guard was a by-product of a long main task. Whoever continues these evals should first
build one that reproduces exactly that. See the section "What these evals could not measure" in
`RESULTS.md`.
