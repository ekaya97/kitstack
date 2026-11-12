# Results of the evals for `fault-injection`

Run on 2026-09-22 in the insai repository as part of its ticket T-0395, under the skill's former
name `eingriff-fahren`. For each task, two fresh agents of the same model with no history, one
without the skill and one told to read it in full first and to follow it. The correct answer was
in `ANSWER.md` and `ANSWER2.md` before the run.

## Task 1, the listing composition guard

The test piece is in `fixture/`. The guard lists two hosts, and a third file in the same
directory builds the forbidden construction directly.

| Arm | Verdict | Correct |
| --- | --- | --- |
| without skill | `DOES NOT HOLD`, cause named correctly | yes |
| with skill | `DOES NOT HOLD`, cause named correctly | yes |

**This task does not discriminate.** It fails the first criterion of T-0395, that the task
demonstrably goes wrong without the skill. The reason is the task's shape, not the skill. Five
files sit in one directory, and the third one with the violation stands out at once. In the real
case, where this shape was found three times on 2026-09-21, it sat among thousands.

One difference was measurable, but not in the result. The arm with the skill ran a fault
injection. It added the third file to the list as a trial, watched the test go red, and so also
proved that the check logic itself works and only the list fails to reach the file. The arm
without the skill read the code and ran the test once. Both reached the same verdict, one with
evidence and one with an inference.

This is recorded as the result and was not replaced by an easier task.

## Task 2, the guard that reads zero files

The test piece is in `fixture2/`. The guard lists nothing, it reads the directory itself, and its
comment promises that a new file is covered without a change to the test. It filters on `.tsx`
while every file ends in `.ts`, so both loops run zero times. Two real violations stand
unreported in the tree.

The difference from the first task is that reading gives the wrong answer here and a green run
confirms it.

| Arm | Verdict | Cause correct | Fault injected |
| --- | --- | --- | --- |
| without skill | `DOES NOT HOLD` | yes | no, read the code and ran it once |
| with skill | `DOES NOT HOLD` | yes | yes, changed `.tsx` to `.ts` and saw both violations appear |

**This task does not discriminate either.** Both arms name the empty file list as the cause.

The arm with the skill also found a second gap. `readdirSync` without `recursive: true` would
never reach `src/rules/`, even with the right extension. It marked this as a side finding and did
not mix it with the main cause.

## Task 3, the self-built guard

The test piece is in `fixture3a` and `fixture3b`, two identical copies so the arms do not get in
each other's way. This time there is no given wrong answer. The subject builds the guard itself
and then judges its own work. Two real violations stand in the tree. `queue-worker.ts` and
`scheduler.ts` unpack the configuration with a type assertion instead of going through
`loadConfig`.

This task reproduces the state in which, in the night to 2026-09-22, a guard that guarded nothing
was delivered three times. The first two tasks present checking as **the** task, and in that
state nobody is careless.

| Arm | Verdict | Test reports both violations | Fault injected |
| --- | --- | --- | --- |
| without skill | `MY TEST HOLDS` | yes, 2 of 9 red at exactly the two places | yes, fully |
| with skill | `MY TEST HOLDS` | yes, 2 of 35 red at exactly the two places | yes, fully |

The arm without the skill ran the method on its own, without knowing it. It fixed both violations
temporarily and saw the test go green, reset them and saw it go red again, and then built a
harmless neighbouring function that only passes `raw` through, to rule out a false alarm. Along
the way it found a bug in its own test. Its brace counting caught the return type instead of the
function body.

The arm with the skill reached the same verdict and proved more. Its flip test ran on the real
file instead of a copy. It wrote twenty legitimate neighbour cases instead of one and checked six
defect variants, among them the angle-bracket assertion syntax, `any` instead of `unknown` and an
alias hop.

One difference in construction stood out, and it is a single data point, no more. The arm without
the skill built its guard on a text search with its own brace counting. The arm with the skill
built it on the TypeScript syntax tree, with an explicit comment that it did not want to match a
guessed spelling. That is the shape the skill then called "Mismatched mechanism", now covered by
step 2 and the "Spellings" case.

## Overall result

**Three tasks, six arms, six correct answers. The skill changed the result in none of the three
pairs.**

That fails the second criterion of T-0395. It requires a repeatable eval per skill that fails
without the skill and passes with it, and none of the three does.

### What measurably changed

Not the verdict, but the evidence. In all three pairs the arm with the skill ran a fault
injection and backed its verdict with it, while the arm without the skill inferred from reading
twice. Task 3 showed the largest difference, twenty checked neighbours against one, and a guard
on the syntax tree instead of the text.

For someone who must accept or reject another agent's work, evidence is not the same as a correct
inference. That is a value, but it is not the value the skill claims for itself.

### What these evals could not measure, and that is the limitation

All three tasks are small, closed test pieces, and in all three **checking is the task**. The
first sentence tells the subject to judge a guard.

The three real cases the skill came from looked different. There an implementer had built
something for two hours, the guard was a by-product, the implementer took it as correct, and
checking was the last step before handing over. Task 3 comes closest but does not reach it. It
takes minutes, not hours, and the guard is the only result there, not an add-on.

An eval that reproduces that state would have to set a long main task at whose end the guard
falls out on the side. That can be built and was not built in that session.

### What follows

The skill stays, for a reason that is not measured. It gives the practice a name, and a
coordinator can cite it when rejecting delivered work. That happened four times in the night to
2026-09-22. Whether the citation caused the rework or only accompanied it is not proven.

For the four further skills planned in T-0395, the answer on this evidence was **no**. Whoever
builds them should first build an eval that contains the long main task, and only then the skill.
Otherwise a second opinion lands in a file, and T-0395 itself warns against exactly that.
