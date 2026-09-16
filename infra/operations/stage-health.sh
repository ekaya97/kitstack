#!/usr/bin/env bash
set -euo pipefail

# Read-only HTTP health probe for a deployed KitStack stage.
# Example:
#   bash infra/operations/stage-health.sh --mcp-url https://mcp.example.com --web-url https://kitstack.example.com --voice-url https://voice.example.com

TIMEOUT_SECONDS="10"
MCP_URL=""
WEB_URL=""
VOICE_URL=""

usage() {
  sed -n '2,7p' "$0"
  cat <<'USAGE'

Options:
  --mcp-url URL       Probe /.well-known/oauth-authorization-server
  --web-url URL       Probe the web application's root URL
  --voice-url URL     Probe the voice service's /healthz endpoint
  --timeout SECONDS   Per-request timeout (default: 10)
  -h, --help          Show this help

At least one endpoint is required. Exit status is non-zero if any supplied
probe fails. No AWS or application state is changed.
USAGE
}

normalise_base_url() {
  local value="$1"
  value="$(printf '%s' "$value" | sed 's:/*$::')"
  case "$value" in
    http://*|https://*) printf '%s' "$value" ;;
    *) echo "Invalid URL (expected http:// or https://): $value" >&2; return 2 ;;
  esac
}

probe() {
  local label="$1"
  local url="$2"
  local status

  if ! status="$(curl --silent --show-error --output /dev/null \
    --write-out '%{http_code}' --max-time "$TIMEOUT_SECONDS" "$url")"; then
    echo "FAIL  $label  $url  (request failed)" >&2
    return 1
  fi

  if [[ "$status" != 2* ]]; then
    echo "FAIL  $label  $url  (HTTP $status)" >&2
    return 1
  fi

  echo "PASS  $label  $url  (HTTP $status)"
}

while (($# > 0)); do
  case "$1" in
    --mcp-url)
      [[ $# -ge 2 ]] || { echo "--mcp-url requires a URL" >&2; exit 2; }
      MCP_URL="$2"; shift 2 ;;
    --web-url)
      [[ $# -ge 2 ]] || { echo "--web-url requires a URL" >&2; exit 2; }
      WEB_URL="$2"; shift 2 ;;
    --voice-url)
      [[ $# -ge 2 ]] || { echo "--voice-url requires a URL" >&2; exit 2; }
      VOICE_URL="$2"; shift 2 ;;
    --timeout)
      [[ $# -ge 2 ]] || { echo "--timeout requires seconds" >&2; exit 2; }
      TIMEOUT_SECONDS="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if ! [[ "$TIMEOUT_SECONDS" =~ ^[1-9][0-9]*$ ]]; then
  echo "--timeout must be a positive integer" >&2
  exit 2
fi

if [[ -z "$MCP_URL$WEB_URL$VOICE_URL" ]]; then
  echo "At least one URL is required" >&2
  usage >&2
  exit 2
fi

failures=0
if [[ -n "$MCP_URL" ]]; then
  MCP_URL="$(normalise_base_url "$MCP_URL")"
  probe "MCP OAuth metadata" "$MCP_URL/.well-known/oauth-authorization-server" || failures=$((failures + 1))
fi
if [[ -n "$WEB_URL" ]]; then
  WEB_URL="$(normalise_base_url "$WEB_URL")"
  probe "Web root" "$WEB_URL" || failures=$((failures + 1))
fi
if [[ -n "$VOICE_URL" ]]; then
  VOICE_URL="$(normalise_base_url "$VOICE_URL")"
  probe "Voice health" "$VOICE_URL/healthz" || failures=$((failures + 1))
fi

if ((failures > 0)); then
  echo "$failures health probe(s) failed" >&2
  exit 1
fi

echo "All requested health probes passed."
