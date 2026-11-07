#!/usr/bin/env bash
# Build and restart the sales voice service (kits/debrief) on its Hetzner box.
#
#   scripts/deploy-voice.sh            deploy the current commit
#
# The box runs it as the Compose project /opt/kitstack/voice behind the box's
# Traefik (HTTPS, WebSockets). Its environment lives in
# /opt/kitstack/voice/voice.env (root-only) and is never copied by this
# script; edit it on the box for secret rotation or turn-taking overrides
# (OPENAI_REALTIME_VAD_THRESHOLD, OPENAI_REALTIME_SILENCE_MS,
# OPENAI_REALTIME_PREFIX_PADDING_MS, KITSTACK_VOICE_BARGE_IN_MS).
set -euo pipefail

HOST="${KITSTACK_VOICE_SSH:-root@insai-qa-box}"
DIR=/opt/kitstack/voice
cd "$(dirname "$0")/.."

if [ -n "$(git status --porcelain --untracked-files=no -- packages/sdk packages/voice packages/crm kits/debrief)" ]; then
  echo "Commit the voice service changes first; the image is tagged with the commit." >&2
  exit 1
fi
TAG="$(git rev-parse --short HEAD)"

# The image imports the SDK's built files.
npm run build --workspace @kitstackco/sdk >/dev/null

rsync -az --delete --relative \
  --exclude node_modules --exclude .kitstack --exclude .sst --exclude sst-env.d.ts --exclude index.html \
  ./package.json ./package-lock.json ./.dockerignore \
  ./web/package.json ./packages/mcp-server/package.json ./packages/authz/package.json \
  ./packages/sdk ./packages/voice ./packages/crm ./kits/debrief \
  "$HOST:$DIR/build/"

ssh "$HOST" bash -s -- "$TAG" <<'REMOTE'
set -euo pipefail
TAG="$1"
cd /opt/kitstack/voice
docker build -q -f build/kits/debrief/Dockerfile -t "kitstack-voice:$TAG" build >/dev/null
sed -i "s/^KITSTACK_VOICE_TAG=.*/KITSTACK_VOICE_TAG=$TAG/" .env
docker compose up -d
for _ in $(seq 1 30); do
  status="$(docker inspect -f '{{.State.Health.Status}}' kitstack-voice)"
  [ "$status" = healthy ] && break
  sleep 3
done
echo "kitstack-voice:$TAG is $status"
[ "$status" = healthy ]
REMOTE
