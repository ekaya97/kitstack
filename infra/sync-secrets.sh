#!/usr/bin/env bash
set -euo pipefail

# Sync secrets from a .env file to SST secrets for a given stage.
#
# Usage:
#   ./infra/sync-secrets.sh <stage> [env-file] [--clear-missing]
#
# Examples:
#   ./infra/sync-secrets.sh eneskaya   # reads .env.eneskaya
#   ./infra/sync-secrets.sh production # reads .env.production
#   ./infra/sync-secrets.sh demo .env.demo
#
# The env file should use SST secret names as keys (PascalCase):
#   BetterAuthSecret=my-secret-value
#   McpJwtSecret=another-secret
#
# Empty values are set as empty strings. Missing values are skipped by default;
# pass --clear-missing to explicitly clear missing secrets.

STAGE="${1:?Usage: $0 <stage> [env-file] [--clear-missing]}"
ENV_FILE="${2:-.env.${STAGE}}"
CLEAR_MISSING="false"
if [[ "${3:-}" == "--clear-missing" ]]; then
  CLEAR_MISSING="true"
elif [[ -n "${3:-}" ]]; then
  echo "Error: unknown option '$3' (expected --clear-missing)"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE not found"
  exit 1
fi

# SST secret names (must match infra/secrets.ts)
SST_SECRETS=(
  TursoDbUrl
  TursoAuthToken
  TursoPlatformApiToken
  TursoOrgName
  BetterAuthSecret
  BetterAuthUrl
  GoogleClientId
  GoogleClientSecret
  GithubClientId
  GithubClientSecret
  McpJwtSecret
  McpAllowedOrigins
  McpInternalApiKey
  LemonsqueezyApiKey
  LemonsqueezyStoreId
  LemonsqueezyWebhookSecret
  PosthogKey
  PosthogHost
  DemoAdminToken
  DemoAllowedDestination
  TwilioAccountSid
  TwilioAuthToken
  TwilioFromNumber
  OpenAiApiKey
)

echo "Syncing secrets from $ENV_FILE to stage '$STAGE'..."
echo ""

count=0

read_env_value() {
  local name="$1"
  local line value

  while IFS= read -r line || [[ -n "$line" ]]; do
    # Trim leading whitespace and ignore blank/comment lines.
    line="${line#"${line%%[![:space:]]*}"}"
    [[ -z "$line" || "${line:0:1}" == "#" ]] && continue
    [[ "$line" == export\ * ]] && line="${line#export }"
    [[ "$line" != "$name="* ]] && continue

    value="${line#*=}"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    if [[ ${#value} -ge 2 ]]; then
      if [[ "${value:0:1}" == "\"" && "${value: -1}" == "\"" ]] ||
         [[ "${value:0:1}" == "'" && "${value: -1}" == "'" ]]; then
        value="${value:1:${#value}-2}"
      fi
    fi
    printf '%s' "$value"
    return 0
  done < "$ENV_FILE"

  return 1
}

for name in "${SST_SECRETS[@]}"; do
  if ! value=$(read_env_value "$name"); then
    if [[ "$CLEAR_MISSING" == "true" ]]; then
      value=""
    else
      echo "  skip  $name (not present)"
      continue
    fi
  fi

  if [[ -z "$value" ]]; then
    echo "  set   $name (empty)"
  else
    echo "  set   $name"
  fi

  printf '%s' "${value:-}" | npx sst secret set "$name" --stage "$STAGE"
  count=$((count + 1))
done

echo ""
echo "Done. Set $count secret(s) for stage '$STAGE'."
