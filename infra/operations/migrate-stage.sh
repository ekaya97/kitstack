#!/usr/bin/env bash
set -euo pipefail

# Validate and deploy a forward-only kit migration from an immutable Git ref.
# The candidate is built in a temporary detached worktree. The operator
# checkout and live database are never modified by the planning path.
# Plan:
#   bash infra/operations/migrate-stage.sh --stage production --ref <sha> --kit kits/debrief
# Execute:
#   ... --execute --confirm-migration

STAGE=""
REF=""
KIT_ROOT=""
EXECUTE="false"
CONFIRM="false"

usage() {
  sed -n '2,10p' "$0"
  cat <<'USAGE'

Options:
  --stage STAGE            SST stage to deploy (required)
  --ref REF                immutable Git commit or tag to validate (required)
  --kit PATH               kit path relative to repository root (required)
  --execute                build the candidate and deploy it
  --confirm-migration      required with --execute; explicit safety gate
  -h, --help               Show this help

Without --execute this command only validates the ref and prints the
migration plan. It never creates a worktree, runs npm, or deploys SST.
Migrations are forward-only: this command does not generate down migrations,
restore a database, or rewrite migration files.
USAGE
}

while (($# > 0)); do
  case "$1" in
    --stage)
      [[ $# -ge 2 ]] || { echo "--stage requires a value" >&2; exit 2; }
      STAGE="$2"; shift 2 ;;
    --ref)
      [[ $# -ge 2 ]] || { echo "--ref requires a Git ref" >&2; exit 2; }
      REF="$2"; shift 2 ;;
    --kit)
      [[ $# -ge 2 ]] || { echo "--kit requires a path" >&2; exit 2; }
      KIT_ROOT="$2"; shift 2 ;;
    --execute) EXECUTE="true"; shift ;;
    --confirm-migration) CONFIRM="true"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [[ -z "$STAGE" || -z "$REF" || -z "$KIT_ROOT" ]]; then
  echo "--stage, --ref, and --kit are required" >&2
  usage >&2
  exit 2
fi

# A kit must be inside this repository. This also prevents an accidental
# absolute path from making the script operate on an unrelated checkout.
case "$KIT_ROOT" in
  /*|../*|*/../*|.|./*)
    echo "--kit must be a repository-relative path below kits/" >&2
    exit 2 ;;
esac
case "$KIT_ROOT" in
  kits/*) ;;
  *) echo "--kit must be below kits/" >&2; exit 2 ;;
esac

REPO_ROOT="$(git rev-parse --show-toplevel)"
COMMIT="$(git -C "$REPO_ROOT" rev-parse --verify "$REF^{commit}")"
git -C "$REPO_ROOT" cat-file -e "$COMMIT:sst.config.ts"
git -C "$REPO_ROOT" cat-file -e "$COMMIT:$KIT_ROOT/kit.config.ts"

MIGRATION_FILES="$(git -C "$REPO_ROOT" ls-tree -r --name-only "$COMMIT" -- "$KIT_ROOT/migrations" || true)"
MIGRATION_HASH="none"
if [[ -n "$MIGRATION_FILES" ]]; then
  MIGRATION_HASH="$(
    while IFS= read -r file; do
      git -C "$REPO_ROOT" show "$COMMIT:$file"
    done <<< "$MIGRATION_FILES" | shasum -a 256 | awk '{print $1}'
  )"
fi

echo "Migration plan"
echo "  stage:       $STAGE"
echo "  ref:         $REF"
echo "  commit:      $COMMIT"
echo "  kit:         $KIT_ROOT"
echo "  migration:   $MIGRATION_HASH"
echo "  source:      temporary detached worktree"
echo "  action:      kitstack build, then npx sst deploy --stage $STAGE"
echo "  rollback:    redeploy a known-good ref; schema changes remain forward-only"

if [[ "$EXECUTE" != "true" ]]; then
  echo "Dry run only. Add --execute --confirm-migration to validate and deploy this ref."
  exit 0
fi

if [[ "$CONFIRM" != "true" ]]; then
  echo "Refusing to execute without --confirm-migration" >&2
  exit 2
fi

WORKTREE="$(mktemp -d "${TMPDIR:-/tmp}/kitstack-migration.XXXXXX")"
cleanup() {
  git -C "$REPO_ROOT" worktree remove --force "$WORKTREE" >/dev/null 2>&1 || true
}
trap cleanup EXIT

git -C "$REPO_ROOT" worktree add --detach "$WORKTREE" "$COMMIT"
(
  cd "$WORKTREE"
  npm ci --ignore-scripts --no-audit --no-fund
  npx tsx packages/sdk/src/cli/index.ts build --config "$KIT_ROOT"
  npx sst deploy --stage "$STAGE"
)

echo "Migration deployment completed for $STAGE at $COMMIT (migration $MIGRATION_HASH)."
echo "Run stage-health.sh, exercise a read/write path, and record the observation window before closing the change."
