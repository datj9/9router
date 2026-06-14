#!/usr/bin/env bash
# Roll 9router back to the previous image after a bad deploy.
#
# deploy.sh tags the image that was running before each deploy as
# `9router:previous`. This script recreates the app container from that tag,
# holding the port with the maintenance page during the swap, then health-checks.
#
# Usage: ./rollback.sh [image-tag]
#   image-tag   image to roll back to (default: 9router:previous)

set -euo pipefail

APP_NAME="9router"
ROLLBACK_IMAGE="${1:-9router:previous}"
MAINT_NAME="9router-maintenance"
MAINT_IMAGE="9router-maintenance:latest"
HOST_PORT=20128
DATA_VOLUME="9router-data"
HEALTH_URL="http://127.0.0.1:${HOST_PORT}/"
HEALTH_TIMEOUT_SECONDS=90

log() { printf '\033[1;33m[rollback]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[rollback] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

# --- 1. Verify the rollback target exists -----------------------------------
if ! docker image inspect "${ROLLBACK_IMAGE}" >/dev/null 2>&1; then
  log "Available 9router images:"
  docker images '9router' --format '  {{.Repository}}:{{.Tag}}\t{{.ID}}\t{{.CreatedSince}}' || true
  fail "Rollback image '${ROLLBACK_IMAGE}' not found. Pass an explicit tag: ./rollback.sh <image:tag>"
fi
log "Rolling back ${APP_NAME} to ${ROLLBACK_IMAGE}."

start_maintenance() {
  if docker image inspect "${MAINT_IMAGE}" >/dev/null 2>&1; then
    docker rm -f "${MAINT_NAME}" >/dev/null 2>&1 || true
    docker run -d --name "${MAINT_NAME}" \
      -p "${HOST_PORT}:${HOST_PORT}" \
      -e "MAINTENANCE_PORT=${HOST_PORT}" \
      "${MAINT_IMAGE}" >/dev/null && log "Maintenance page is holding port ${HOST_PORT}."
  fi
}

stop_maintenance() {
  docker rm -f "${MAINT_NAME}" >/dev/null 2>&1 || true
}

# --- 2. Swap the bad container for the rollback image ------------------------
log "Stopping current ${APP_NAME}..."
docker stop "${APP_NAME}" >/dev/null 2>&1 || true
start_maintenance
docker rm "${APP_NAME}" >/dev/null 2>&1 || true

log "Starting ${APP_NAME} from ${ROLLBACK_IMAGE}..."
stop_maintenance
# DATA_DIR must stay /app/data and match the volume mount, or usage data is
# written inside the container layer and lost on the next `docker rm`.
docker run -d --name "${APP_NAME}" \
  --restart unless-stopped \
  -p "${HOST_PORT}:${HOST_PORT}" \
  -v "${DATA_VOLUME}:/app/data" \
  -e "DATA_DIR=/app/data" \
  "${ROLLBACK_IMAGE}" >/dev/null

# --- 3. Health check --------------------------------------------------------
log "Waiting for health check at ${HEALTH_URL} (timeout ${HEALTH_TIMEOUT_SECONDS}s)..."
deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))
until curl -fsS -o /dev/null --max-time 3 "${HEALTH_URL}"; do
  if (( SECONDS >= deadline )); then
    docker logs --tail 50 "${APP_NAME}" || true
    fail "Rollback container did NOT become healthy. The previous image may also be broken — inspect logs above."
  fi
  sleep 2
done

log "Rollback complete — ${APP_NAME} is healthy on ${ROLLBACK_IMAGE} (port ${HOST_PORT})."
docker ps --filter "name=${APP_NAME}" --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
