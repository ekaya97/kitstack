# KitStack operations runbook

This is the operational slice for T-0213. It describes the infrastructure
that exists today and gives an operator safe, repeatable procedures for health,
rollback, migrations, secret rotation, and backup/restore rehearsal.

The current deployment is SST v4 on AWS in `eu-central-1`:

- `kitstack` web application (Next.js/OpenNext)
- `McpRouter` Lambda behind `mcp.kitstack.co` in production
- `AppData`, relay, kill-switch, and dynamically provisioned `Kit-*` Lambdas
- `MCPAuthStore`, `DevRelayStore`, and `UserKitDbs` DynamoDB tables
- Turso/libSQL platform database and per-user kit databases
- S3 buckets and CloudFront routers for web, user, skill, and kit assets
- the debrief voice service as an SST ECS service behind an ALB, when
  `KITSTACK_DEMO_VOICE_DOMAIN` is configured

`T-0211` is now available: `kitstack build` emits a signed, hash-addressed
container context and `kitstack.yaml`. The current stage still deploys through
SST; the generated artifact is the portable hand-off for a later Fargate or
Kubernetes adapter. The operational scripts below keep that distinction
explicit.

## Operating principles

1. Use a named stage and a pinned Git commit for every deployment.
2. Take or verify a backup before applying a schema-changing deployment.
3. Prefer read-only checks first. Every mutating helper in this directory is
   opt-in and requires an explicit confirmation flag.
4. A code rollback is not a database rollback. KitStack migrations are
   forward-only and `DROP` statements are rejected by the SDK build validator.
5. Never place secret values in shell arguments, logs, tickets, screenshots, or
   incident chat. Use an env file with mode `600` and delete or vault it after
   the operation.
6. Record the commit, stage, UTC timestamps, commands, result, and operator in
   the T-0213 work log or the incident record.

## Access and preflight

Use the AWS profile/credentials authorized for the target stage. SST resource
bindings are available inside `sst shell`; ordinary AWS CLI checks use the
configured AWS profile and region.

```bash
export AWS_REGION=eu-central-1
aws sts get-caller-identity
npx sst shell --stage production -- npx tsx scripts/get-urls.ts
```

Before a change, capture source state without printing secrets:

```bash
git rev-parse HEAD
git status --short
aws cloudformation describe-stacks \
  --stack-name kitstack-production \
  --region eu-central-1 \
  --query 'Stacks[0].{Status:StackStatus,Updated:LastUpdatedTime}'
aws cloudformation describe-stack-resources \
  --stack-name kitstack-production \
  --region eu-central-1 \
  --query 'StackResources[].{Type:ResourceType,Logical:LogicalResourceId,Physical:PhysicalResourceId,Status:ResourceStatus}' \
  --output table
```

If the SST-generated stack name differs, use the exact name shown by SST or
CloudFormation. Do not omit `--stack-name`: an account-wide query is
unnecessarily broad.

## Health check

The repository's HTTP health helper is read-only:

```bash
bash infra/operations/stage-health.sh \
  --mcp-url https://mcp.kitstack.co \
  --web-url https://kitstack.co \
  --voice-url https://voice.example.com
```

It checks public OAuth metadata for MCP, the web root, and `/healthz` for the
voice service. At least one URL is required; omit the voice URL when the demo
service is not deployed. It does not send bearer tokens or inspect customer
data.

For an AWS-side check, use the CloudFormation resource inventory to identify
the physical Lambda, ALB, target group, and log group names, then run only
read-only commands:

```bash
aws lambda get-function --function-name <physical-function-name> \
  --region eu-central-1 \
  --query 'Configuration.{State:State,LastModified:LastModified,Version:Version}'
aws lambda get-function-concurrency --function-name <physical-function-name> \
  --region eu-central-1
aws elbv2 describe-target-health --target-group-arn <target-group-arn> \
  --region eu-central-1
aws logs filter-log-events --log-group-name <log-group-name> \
  --start-time "$(( $(date +%s) * 1000 - 900000 ))" \
  --region eu-central-1 --query 'events[-20:].message'
```

A failed HTTP check is a release blocker. Check Lambda state, ALB target
health, recent error logs, and the latest CloudFormation events before
retrying a deploy. The existing `scripts/restore-concurrency.ts` is an
emergency recovery tool for the kill switch; use it only after confirming the
alarm is understood and the stage is no longer under load.

## Rollback to a pinned ref

The current SST kit deployment updates the named `Kit-{kitId}` function and
the platform stack from source. Roll back application code and infrastructure
by redeploying a known-good Git commit, not by editing a Lambda in the console.

First plan the operation:

```bash
bash infra/operations/rollback-stage.sh \
  --stage production --ref <known-good-commit-or-tag>
```

The helper validates that the ref is a commit containing `sst.config.ts` and
uses a temporary detached worktree, leaving the operator checkout unchanged.
For an approved incident, execute it explicitly:

```bash
bash infra/operations/rollback-stage.sh \
  --stage production \
  --ref <known-good-commit-or-tag> \
  --execute --confirm-rollback
```

After deployment:

1. Run the HTTP and AWS health checks.
2. Exercise one authenticated MCP `tools/list` and one safe read-only kit
   operation.
3. Check CloudWatch errors and the demo dashboard for new failures.
4. Record the rolled-back commit and observation window.

This procedure does not undo a forward-only migration. If the bad release
changed a schema, keep the old code only when it remains compatible with the
new schema, stop further migrations, and escalate a data incident separately.
Do not restore a production database over the source as an improvised rollback.

## Migration procedure

The SDK build validates kit migration SQL against SQLite and rejects
destructive `DROP` statements. Production provisioning applies the kit's
migration SQL to the relevant Turso database; migration state is a platform
concern rather than a local test concern.

The migration helper validates and deploys a pinned kit ref from a temporary
worktree. It is a release operation, not a standalone SQL editor:

```bash
bash infra/operations/migrate-stage.sh \
  --stage production \
  --ref <candidate-commit-or-tag> \
  --kit kits/debrief
```

Review the printed migration hash and plan. To execute the candidate build and
SST deployment, pass both explicit gates:

```bash
bash infra/operations/migrate-stage.sh \
  --stage production \
  --ref <candidate-commit-or-tag> \
  --kit kits/debrief \
  --execute --confirm-migration
```

For each schema change:

1. Run `migrate-stage.sh` in plan mode. Review the printed migration hash and
   generated migration files
   and confirm the change is additive or has an explicit data-preserving plan.
2. Verify a recent backup and complete a restore rehearsal into a distinct
   disposable database.
3. Execute `migrate-stage.sh` to build and deploy the candidate to the named
   stage during an observation window.
4. Watch migration errors, router errors, latency, and the affected kit's
   read/write operations.
5. If the code is faulty, roll back code only after checking schema
   compatibility. If the migration is faulty, stop the rollout and open a data
   incident; do not rerun edited SQL against production.
6. Record the migration version/hash, affected kit/user scope, start/end times,
   result, and compatibility decision.

The design note in [docs/blue-green-kit-deploys.md](../../docs/blue-green-kit-deploys.md)
describes the planned versioned-Lambda and background-migration model. That
model is not yet the live deployment contract, so the safe rollback boundary
today is the SST code/infrastructure deployment plus a separately approved
data recovery operation.

## Secret rotation

The source of truth for SST-linked secret names is `infra/secrets.ts`. The
existing `infra/sync-secrets.sh` can sync a complete env file, but rotation
should normally touch only selected secret names. The allow-listed helper does
that and defaults to a plan:

```bash
chmod 600 .env.production
bash infra/operations/rotate-secrets.sh \
  --stage production \
  --env-file .env.production \
  --secret McpJwtSecret \
  --secret DemoInternalSecret
```

Review the names and values out-of-band. Then perform the selected update:

```bash
bash infra/operations/rotate-secrets.sh \
  --stage production \
  --env-file .env.production \
  --secret McpJwtSecret \
  --secret DemoInternalSecret \
  --confirm-rotation --deploy
```

Important consequences:

- Rotating `McpJwtSecret` invalidates existing MCP access tokens. Reconnect
  clients and verify OAuth issuance/revocation afterward.
- Rotating `BetterAuthSecret` can invalidate application sessions depending on
  auth configuration. Schedule it with an operator who can reauthenticate.
- Rotate provider credentials (`TwilioAuthToken`, `OpenAiApiKey`) with the
  provider's overlap/revocation procedure first; then update KitStack and run a
  provider smoke test.
- `DemoInternalSecret` must be updated for every service that signs or checks
  the internal bridge. A partial update causes bridge failures.
- The helper refuses missing or empty values and never uses
  `--clear-missing`. It does not support dual-key validation; if a provider
  needs overlap, perform that at the provider and schedule the KitStack update
  as a coordinated change.

After rotation, run health checks, one authenticated MCP request, the relevant
provider check, and (for JWT/auth changes) an explicit old-token rejection
check. Revoke or remove the old provider credential only after the observation
window.

## Backup and restore rehearsal

The platform's primary relational data path is Turso/libSQL. The helper
rehearses a SQL dump into an already-created, distinct target. It refuses to
overwrite an existing local dump, restore into the source database, or use a
target whose name does not contain `restore` or `rehearsal`.

Plan:

```bash
bash infra/operations/backup-restore-rehearsal.sh \
  --source-db <production-db-name-or-replica-url> \
  --restore-db <pre-created-disposable-restore-db> \
  --backup-file /tmp/kitstack-production-$(date +%Y%m%dT%H%M%SZ).sql
```

After verifying the target is disposable and the dump path is appropriate:

```bash
bash infra/operations/backup-restore-rehearsal.sh \
  --source-db <production-db-name-or-replica-url> \
  --restore-db <pre-created-disposable-restore-db> \
  --backup-file /tmp/kitstack-production-$(date +%Y%m%dT%H%M%SZ).sql \
  --execute --confirm-restore
```

The command runs `turso db shell <source> ".dump"`, restores the SQL into the
target, and runs `SELECT 1`. For evidence, also compare representative table
counts and schema metadata without exporting customer rows:

```bash
turso db shell <source> "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
turso db shell <restore-target> "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

The control plane also contains DynamoDB tables and S3 assets. Before beta,
the operator must verify the account's DynamoDB point-in-time recovery/on-demand
backup policy and S3 versioning policy for the exact physical resources in the
CloudFormation inventory. These are not enabled explicitly in the current SST
definitions, so do not claim DynamoDB or S3 restore coverage from the Turso
rehearsal alone. A DynamoDB table-level rehearsal, when approved, should use a
new target table via `restore-table-from-backup` and must not replace the live
table in place.

## Rehearsal evidence

Attach this minimum record to T-0213 or the incident system:

```text
Stage / region:
Source commit:
Operator / UTC start / UTC end:
Health evidence:
Rollback ref and result:
Migration version/hash and compatibility decision:
Secret names rotated (names only; no values):
Backup source / restore target:
Restore verification (schema/count checks):
Observed RTO / RPO:
CloudWatch and dashboard links:
Follow-ups / approval:
```

The code and docs slice is complete when the helpers pass local validation.
T-0213's acceptance requirement for a rollback and restore against a deployed
stage remains an operator rehearsal: it must be run against the selected stage
with evidence and must not be represented as complete from a local dry run.
