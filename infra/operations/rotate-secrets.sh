#!/usr/bin/env bash
set -euo pipefail

# Rotate selected SST secrets from an env file without printing their values.
# Dry-run is the default. Missing keys are never cleared.
# Plan:
#   bash infra/operations/rotate-secrets.sh --stage production --env-file .env.production --secret McpJwtSecret
# Execute:
#   bash infra/operations/rotate-secrets.sh --stage production --env-file .env.production --secret McpJwtSecret --confirm-rotation

STAGE=""
ENV_FILE=""
CONFIRM="false"
DEPLOY="false"
SECRET_NAMES=""

readonly ALLOWED_SECRETS="BetterAuthSecret McpJwtSecret McpInternalApiKey DemoInternalSecret TursoAuthToken TwilioAuthToken OpenAiApiKey"

usage() {
  sed -n '2,10p' "$0"
  cat <<'USAGE'

Options:
  --stage STAGE            SST stage (required)
  --env-file FILE          source env file (required)
  --secret NAME            rotate one allowed secret; repeatable (required)
  --confirm-rotation       write secrets; otherwise plan only
  --deploy                 after rotation, run npx sst deploy --stage STAGE
  -h, --help               Show this help

Values are read from stdin by sst secret set and are never printed. Missing
keys are an error. --deploy is separately gated by --confirm-rotation.
USAGE
}

contains_secret() {
  case " $ALLOWED_SECRETS " in
    *" $1 "*) return 0 ;;
    *) return 1 ;;
  esac
}

read_env_value() {
  local name="$1"
  local line value
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="$(printf '%s' "$line" | sed 's/^[[:space:]]*//')"
    [[ -z "$line" || "${line:0:1}" == "#" ]] && continue
    [[ "$line" == export\ * ]] && line="${line#export }"
    [[ "$line" != "$name="* ]] && continue
    value="${line#*=}"
    value="$(printf '%s' "$value" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"
    if [[ ${#value} -ge 2 ]]; then
      if [[ "${value:0:1}" == '"' && "${value: -1}" == '"' ]] ||
         [[ "${value:0:1}" == "'" && "${value: -1}" == "'" ]]; then
        value="${value:1:${#value}-2}"
      fi
    fi
    printf '%s' "$value"
    return 0
  done < "$ENV_FILE"
  return 1
}

while (($# > 0)); do
  case "$1" in
    --stage)
      [[ $# -ge 2 ]] || { echo "--stage requires a value" >&2; exit 2; }
      STAGE="$2"; shift 2 ;;
    --env-file)
      [[ $# -ge 2 ]] || { echo "--env-file requires a file" >&2; exit 2; }
      ENV_FILE="$2"; shift 2 ;;
    --secret)
      [[ $# -ge 2 ]] || { echo "--secret requires a name" >&2; exit 2; }
      SECRET_NAMES="$SECRET_NAMES $2"; shift 2 ;;
    --confirm-rotation) CONFIRM="true"; shift ;;
    --deploy) DEPLOY="true"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [[ -z "$STAGE" || -z "$ENV_FILE" || -z "$SECRET_NAMES" ]]; then
  echo "--stage, --env-file, and at least one --secret are required" >&2
  usage >&2
  exit 2
fi
[[ -f "$ENV_FILE" ]] || { echo "Env file not found: $ENV_FILE" >&2; exit 2; }

for name in $SECRET_NAMES; do
  contains_secret "$name" || { echo "Secret is not allow-listed for rotation: $name" >&2; exit 2; }
  value="$(read_env_value "$name")"
  [[ -n "$value" ]] || { echo "Missing or empty key in env file: $name" >&2; exit 2; }
  echo "READY $name (value present; value hidden)"
done

if [[ "$CONFIRM" != "true" ]]; then
  echo "Dry run only. Add --confirm-rotation to write the selected SST secrets."
  exit 0
fi

for name in $SECRET_NAMES; do
  value="$(read_env_value "$name")"
  printf '%s' "$value" | npx sst secret set "$name" --stage "$STAGE"
  echo "ROTATED $name"
done

if [[ "$DEPLOY" == "true" ]]; then
  npx sst deploy --stage "$STAGE"
  echo "Deployment completed; run stage-health.sh and inspect auth/provider probes."
else
  echo "Secrets updated. Run an intentional SST deploy before relying on the new values in deployed functions."
fi
