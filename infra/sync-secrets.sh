#!/usr/bin/env bash
set -euo pipefail

# Sync secrets from a .env file to SST secrets for a given stage.
#
# Usage:
#   ./scripts/sync-secrets.sh <stage>
#
# Examples:
#   ./scripts/sync-secrets.sh eneskaya   # reads .env.eneskaya
#   ./scripts/sync-secrets.sh production # reads .env.production
#
# The env file should use SST secret names as keys (PascalCase):
#   BetterAuthSecret=my-secret-value
#   McpJwtSecret=another-secret

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
  value=$(grep -E "^${name}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d'=' -f2-)

  if [[ -z "$value" ]]; then
    echo "  skip  $name (empty or not in $ENV_FILE)"
    continue
  fi

  echo "  set   $name"
  npx sst secret set "$name" "$value" --stage "$STAGE" 2>/dev/null
  ((count++))
done

echo ""
echo "Done. Set $count secret(s) for stage '$STAGE'."
