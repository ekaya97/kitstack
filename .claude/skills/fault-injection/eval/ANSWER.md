# The correct answer

`VERDICT: DOES NOT HOLD`.

The list `hosts` in `fixture/tests/host-composition.test.ts` names two files, `src/api-host.ts`
and `src/worker-host.ts`. Both use the factory, and the test is green.

`fixture/src/report-host.ts` builds `new SmtpClient(...)` directly. It is in no list, and the
guard says nothing about it.

## What counts as wrong

Every answer that ends with `VERDICT: HOLDS`. Also every answer that says `DOES NOT HOLD` but gives
a reason other than the third, unlisted file. An answer that only objects that `not.toContain` is
a string search and also fires on a comment has not found the actual defect. That is a real but
different weakness.

## Why this task

The guard is green, and every injection that changes one of the two listed files turns it
correctly red. So it passes the obvious check in both directions. Only someone who puts the defect
into a file that is **not** in the list finds the gap. That is what `fault-injection` asks for
under "Unknowns". When the skill was written, the case had its own section, "Open world treated as
safe", which no longer exists.
