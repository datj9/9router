#!/usr/bin/env bash
# Redeploy 9router with near-zero downtime.
#
# Sequence:
#   1. Build the new app image while the old container keeps serving.
#   2. Swap: stop app -> maintenance container holds port 20128 (503 + Retry-After)
#      -> recreate app container -> health check -> stop maintenance.
#   3. On a failed health check the maintenance page comes back up and the old
#      image is still tagged 9router:previous for manual rollback.
#
# Usage: ./deploy.sh [--no-pull]
#   --no-pull   skip `git pull` (deploy whatever is in the working tree)

set -euo pipefail

APP_NAME="9router"
IMAGE="9router:latest"
PREVIOUS_IMAGE="9router:previous"
MAINT_NAME="9router-maintenance"
MAINT_IMAGE="9router-maintenance:latest"
HOST_PORT=20128
DATA_VOLUME="9router-data"
HEALTH_URL="http://127.0.0.1:${HOST_PORT}/"
HEALTH_TIMEOUT_SECONDS=90
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log() { printf '\033[1;36m[deploy]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[deploy] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

cd "${REPO_DIR}"

# --- 1. Update source -------------------------------------------------------
if [[ "${1:-}" != "--no-pull" ]]; then
  log "Pulling latest master..."
  git pull --ff-only origin master
fi

# --- 2. Snapshot the current image as a rollback target ---------------------
# Must happen BEFORE the build: the build overwrites the ${IMAGE} tag, and on the
# containerd image store the old layers are then garbage-collected — so tagging
# the running container's image digest afterwards fails with "content digest not
# found". Re-tag the existing ${IMAGE} tag (tag->tag) while it still points at the
# old image; that works on both the classic and containerd stores.
if docker image inspect "${IMAGE}" >/dev/null 2>&1; then
  docker tag "${IMAGE}" "${PREVIOUS_IMAGE}"
  log "Saved current ${IMAGE} as ${PREVIOUS_IMAGE} (rollback target)."
else
  log "No existing ${IMAGE} to snapshot — skipping rollback tag (first deploy?)."
fi

# --- 3. Build images while old container still serves ------------------------
log "Building app image (old container keeps serving)..."
docker build -t "${IMAGE}" .

if ! docker image inspect "${MAINT_IMAGE}" >/dev/null 2>&1; then
  log "Building maintenance image (first run only)..."
  docker build -t "${MAINT_IMAGE}" scripts/maintenance
fi

start_maintenance() {
  docker rm -f "${MAINT_NAME}" >/dev/null 2>&1 || true
  docker run -d --name "${MAINT_NAME}" \
    -p "${HOST_PORT}:${HOST_PORT}" \
    -e "MAINTENANCE_PORT=${HOST_PORT}" \
    "${MAINT_IMAGE}" >/dev/null
  log "Maintenance page is holding port ${HOST_PORT}."
}

stop_maintenance() {
  docker rm -f "${MAINT_NAME}" >/dev/null 2>&1 || true
}

# --- 4. Swap containers ------------------------------------------------------
log "Stopping ${APP_NAME}..."
docker stop "${APP_NAME}" >/dev/null 2>&1 || true
start_maintenance
docker rm "${APP_NAME}" >/dev/null 2>&1 || true

log "Releasing port and starting new ${APP_NAME} container..."
stop_maintenance
# DATA_DIR must stay /app/data and match the volume mount — otherwise usage
# data is written inside the container layer and wiped on `docker rm`.
docker run -d --name "${APP_NAME}" \
  --restart unless-stopped \
  -p "${HOST_PORT}:${HOST_PORT}" \
  -v "${DATA_VOLUME}:/app/data" \
  -e "DATA_DIR=/app/data" \
  "${IMAGE}" >/dev/null

# --- 5. Health check ---------------------------------------------------------
log "Waiting for health check at ${HEALTH_URL} (timeout ${HEALTH_TIMEOUT_SECONDS}s)..."
deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))
until curl -fsS -o /dev/null --max-time 3 "${HEALTH_URL}"; do
  if (( SECONDS >= deadline )); then
    log "Health check FAILED — bringing maintenance page back up."
    docker logs --tail 50 "${APP_NAME}" || true
    docker stop "${APP_NAME}" >/dev/null 2>&1 || true
    start_maintenance
    fail "New container unhealthy. Roll back with: docker rm -f ${APP_NAME} && docker run -d --name ${APP_NAME} --restart unless-stopped -p ${HOST_PORT}:${HOST_PORT} -v ${DATA_VOLUME}:/app/data -e DATA_DIR=/app/data ${PREVIOUS_IMAGE} && docker rm -f ${MAINT_NAME}"
  fi
  sleep 2
done

log "Deploy complete — ${APP_NAME} is healthy on port ${HOST_PORT}."
docker image prune -f >/dev/null 2>&1 || true
docker ps --filter "name=${APP_NAME}" --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
