---
name: fault-injection
description: Run a fault injection before a check counts as verified or SAFE, before a new or changed guard merges, before a guard is loosened against false alarms, or before you trust a guard someone else built.
---

# Fault injection

A guard is any check for a class of defect, for example a test, a validator, a scanner or an
allowlist. In kitstack that includes the telemetry content check (`isMetadataOnlyTelemetry` in
`packages/sdk/src/telemetry.ts`), the `DROP` rejection in `packages/sdk/src/build.ts`, the
`kit:act` gate in `packages/mcp-server/src/router/authz.ts` and every test that asserts absence.
A guard counts as verified only after its detection is measured and a counter-check with
legitimate cases has passed. The question for every guard is under which conditions it would
fail. A guard that cannot name one is a label, not a check, and the number of green tests says
nothing about it.

## Steps

1. Name the defect. Describe in one sentence the concrete defect in the artifact under check.
2. Inject the fault. Put that defect back into the artifact the guard actually checks. Produce
   the artifact with the production mechanism, for example the real URL parser, the real
   migration SQL splitter or the real zod schema, not a hand-typed imitation of its output.
3. Watch it go red. Run the guard. If it stays green, its detection is unproven.
4. Restore green. Remove the defect and run the guard again. It must pass.
5. Run the counter-check. Check every legitimate case from the real data, the documented
   freedoms of the target system and at least twenty plausible neighbours of the defect that you
   write out yourself. Every false rejection is a guard failure, just as a missed defect is.
6. Record the evidence. Write one sentence on the injected defect and the observed flip. Write a
   second on the number of legitimate cases and false rejections. Without both sentences and
   passing checks, the guard stays unverified.

## Special cases

Loosening. After you weaken a guard, repeat steps 1 to 4 with the original defect before the
change is done. Fewer rejections after weakening or deleting a guard prove no detection.

Check location. Change the relevant spot and, separately, an irrelevant neighbouring spot. The
guard must react only to the relevant change.

Consumer. Follow an output to the code that actually reads it and check that this reader uses
exactly that value. An output that exists is not enough.

Spellings. Check every form and spelling found in the real data with the real mechanism. For SQL
that means case, comments of both kinds and leading whitespace. For URLs it means what the parser
normalizes, not what the string looks like.

Adoption. When you adopt a mechanism from elsewhere, check whether a key space that was closed
there is open here. Then look for a legitimate case it rejects.

Exemption. Keep the exempted name or path and break the property that justifies its exemption.
The exemption must end.

Unknowns. For config and schema loaders, check that an unknown or misspelled key produces an
error. For guards built on a list of known-bad items or on skipped classifications, also check an
unknown instance of the same kind. The telemetry content check is such a list, so a content field
under a name it does not know is the case to inject. The guard must reject the unclassified
instance. [ANSWER.md](eval/ANSWER.md) shows the shape, a list of two hosts that misses a third.

Build. If the test imports workspace packages by package name and the workspace's vitest config
does not alias them to `src` (as `kits/debrief/vitest.config.ts` does), build those packages
before step 3 and again after the removal in step 4. A targeted test run can otherwise read a
stale `dist/`.
