# Maintained kit validation

The maintained kits are checked against the request-scoped SDK context contract
with:

```sh
npm run typecheck:kits
```

The check covers `adint`, `content-planner`, `crm`, `decision-journal`,
`expenses`, `fressnapf`, `projects`, and `debrief`.

Each kit can also be bundled independently with:

```sh
npm run build --prefix kits/<kit>
```

The content-planner source typechecks, but its current build is blocked by two
pre-existing `0000` migration files that both create the same tables. This
validation change intentionally does not delete or rewrite either migration;
the build reports `table \`ideas\` already exists` when both are applied.
