#!/usr/bin/env bash
set -euo pipefail

# Sync secrets from a .env file to SST secrets for a given stage.
#
# Usage:
#   ./infra/sync-secrets.sh <stage>
#
# Examples:
#   ./infra/sync-secrets.sh eneskaya   # reads .env.eneskaya
#   ./infra/sync-secrets.sh production # reads .env.production
#
# The env file should use SST secret names as keys (PascalCase):
#   BetterAuthSecret=my-secret-value
#   McpJwtSecret=another-secret
#
# Missing or empty values are set as empty string (SST requires all secrets to have a value).

STAGE="${1:?Usage: $0 <stage>}"
ENV_FILE=".env.${STAGE}"

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
)

echo "Syncing secrets from $ENV_FILE to stage '$STAGE'..."
echo ""

count=0

for name in "${SST_SECRETS[@]}"; do
  # Extract value from env file (supports KEY=value, ignores comments/empty lines)
  value=$(grep -E "^${name}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d'=' -f2- || true)

  if [[ -z "$value" ]]; then
    echo "  set   $name (empty)"
  else
    echo "  set   $name"
  fi

  printf '%s' "${value:-}" | npx sst secret set "$name" --stage "$STAGE" 2>/dev/null
  ((count++))
done

echo ""
echo "Done. Set $count secret(s) for stage '$STAGE'."
