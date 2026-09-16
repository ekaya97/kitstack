#!/usr/bin/env bash
set -euo pipefail

# Plan or execute a rollback from an immutable Git ref without changing the
# operator's current checkout. Execution is intentionally opt-in.
# Plan:
#   bash infra/operations/rollback-stage.sh --stage production --ref 5198b76
# Execute:
#   bash infra/operations/rollback-stage.sh --stage production --ref 5198b76 --execute --confirm-rollback

STAGE=""
REF=""
EXECUTE="false"
CONFIRM="false"

usage() {
  sed -n '2,10p' "$0"
  cat <<'USAGE'

Options:
  --stage STAGE            SST stage to deploy (required)
  --ref REF                Git commit/tag to deploy (required)
  --execute                Perform the deploy in a temporary worktree
  --confirm-rollback       Required with --execute; explicit safety gate
  -h, --help               Show this help

Without --execute this command only validates the ref and prints the plan.
It never checks out a branch, deletes a database, or performs a rollback by
default. A rollback restores code/infrastructure from the ref; it does not
reverse forward-only database migrations.
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
    --execute) EXECUTE="true"; shift ;;
    --confirm-rollback) CONFIRM="true"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [[ -z "$STAGE" || -z "$REF" ]]; then
  echo "--stage and --ref are required" >&2
  usage >&2
  exit 2
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
COMMIT="$(git -C "$REPO_ROOT" rev-parse --verify "$REF^{commit}")"
git -C "$REPO_ROOT" cat-file -e "$COMMIT:sst.config.ts"

echo "Rollback plan"
echo "  stage:  $STAGE"
echo "  ref:    $REF"
echo "  commit: $COMMIT"
echo "  source: temporary detached worktree"
echo "  action: npx sst deploy --stage $STAGE"

if [[ "$EXECUTE" != "true" ]]; then
  echo "Dry run only. Add --execute --confirm-rollback to deploy this ref."
  exit 0
fi

if [[ "$CONFIRM" != "true" ]]; then
  echo "Refusing to execute without --confirm-rollback" >&2
  exit 2
fi

WORKTREE="$(mktemp -d "/tmp/kitstack-rollback.XXXXXX")"
cleanup() {
  git -C "$REPO_ROOT" worktree remove --force "$WORKTREE" >/dev/null 2>&1 || true
}
trap cleanup EXIT

git -C "$REPO_ROOT" worktree add --detach "$WORKTREE" "$COMMIT"
(
  cd "$WORKTREE"
  npm ci
  npx sst deploy --stage "$STAGE"
)

echo "Rollback deploy completed for $STAGE at $COMMIT. Run stage-health.sh and inspect CloudWatch before closing the incident."
