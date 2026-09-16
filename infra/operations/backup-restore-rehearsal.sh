#!/usr/bin/env bash
set -euo pipefail

# Rehearse a Turso/libSQL dump and restore into a distinct, pre-created target.
# This script never creates, drops, or overwrites a database. It writes only
# the selected local dump file and requires explicit confirmation.
# Plan:
#   bash infra/operations/backup-restore-rehearsal.sh --source-db prod --restore-db prod-restore --backup-file /tmp/prod.sql
# Execute:
#   ... --execute --confirm-restore

SOURCE_DB=""
RESTORE_DB=""
BACKUP_FILE=""
EXECUTE="false"
CONFIRM="false"

usage() {
  sed -n '2,10p' "$0"
  cat <<'USAGE'

Options:
  --source-db NAME         Turso database name or replica URL (required)
  --restore-db NAME        existing, distinct rehearsal target (required)
  --backup-file FILE       local SQL dump destination (required)
  --execute                perform dump, restore, and SELECT 1 verification
  --confirm-restore        required with --execute
  -h, --help               Show this help

The target must be disposable and different from the source. No production
database is dropped or overwritten by this script.
USAGE
}

while (($# > 0)); do
  case "$1" in
    --source-db)
      [[ $# -ge 2 ]] || { echo "--source-db requires a value" >&2; exit 2; }
      SOURCE_DB="$2"; shift 2 ;;
    --restore-db)
      [[ $# -ge 2 ]] || { echo "--restore-db requires a value" >&2; exit 2; }
      RESTORE_DB="$2"; shift 2 ;;
    --backup-file)
      [[ $# -ge 2 ]] || { echo "--backup-file requires a path" >&2; exit 2; }
      BACKUP_FILE="$2"; shift 2 ;;
    --execute) EXECUTE="true"; shift ;;
    --confirm-restore) CONFIRM="true"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [[ -z "$SOURCE_DB" || -z "$RESTORE_DB" || -z "$BACKUP_FILE" ]]; then
  echo "--source-db, --restore-db, and --backup-file are required" >&2
  usage >&2
  exit 2
fi
if [[ "$SOURCE_DB" == "$RESTORE_DB" ]]; then
  echo "Refusing to restore into the source database" >&2
  exit 2
fi
case "$RESTORE_DB" in
  *restore*|*rehearsal*) ;;
  *) echo "Restore target must include 'restore' or 'rehearsal' in its name" >&2; exit 2 ;;
esac
if [[ -e "$BACKUP_FILE" ]]; then
  echo "Refusing to overwrite existing backup file: $BACKUP_FILE" >&2
  exit 2
fi

echo "Backup/restore rehearsal plan"
echo "  source:  $SOURCE_DB"
echo "  target:  $RESTORE_DB"
echo "  dump:    $BACKUP_FILE"
echo "  action:  turso db shell <source> .dump; restore into target; SELECT 1"

if [[ "$EXECUTE" != "true" ]]; then
  echo "Dry run only. Add --execute --confirm-restore to run against the supplied databases."
  exit 0
fi
if [[ "$CONFIRM" != "true" ]]; then
  echo "Refusing to execute without --confirm-restore" >&2
  exit 2
fi
command -v turso >/dev/null 2>&1 || { echo "turso CLI is required" >&2; exit 2; }

backup_dir="$(dirname "$BACKUP_FILE")"
[[ -d "$backup_dir" ]] || { echo "Backup directory does not exist: $backup_dir" >&2; exit 2; }

turso db shell "$SOURCE_DB" ".dump" > "$BACKUP_FILE"
[[ -s "$BACKUP_FILE" ]] || { echo "Dump was empty; refusing to restore" >&2; exit 1; }
turso db shell "$RESTORE_DB" < "$BACKUP_FILE"
turso db shell "$RESTORE_DB" "SELECT 1;"

echo "Restore rehearsal completed. Preserve the dump and command output as evidence; remove the disposable target through the Turso operator workflow when approved."
