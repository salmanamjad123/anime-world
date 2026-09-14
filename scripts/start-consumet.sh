#!/usr/bin/env bash
# Start self-hosted Consumet API for manga scrapers (mangapill / mangareader / mangakakalot).
# Requires Docker Desktop (or Colima) running.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running. Open Docker Desktop, then re-run this script."
  open -a Docker 2>/dev/null || open -a "Docker Desktop" 2>/dev/null || true
  exit 1
fi

docker compose --env-file /dev/null -f docker-compose.consumet.yaml up -d
echo "Waiting for Consumet on :3333 ..."
for i in $(seq 1 30); do
  if curl -sf -m 2 http://127.0.0.1:3333/ >/dev/null 2>&1 \
    || curl -sf -m 3 "http://127.0.0.1:3333/meta/anilist-manga/info/30002?provider=mangapill" >/dev/null 2>&1; then
    echo "Consumet is up → http://localhost:3333"
    echo "In anime-world/.env.local ensure:"
    echo "  CONSUMET_API_URL=http://localhost:3333"
    exit 0
  fi
  sleep 2
done
echo "Consumet container started but not responding yet. Check: docker ps | grep consumet"
exit 1
