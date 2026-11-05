#!/usr/bin/env bash
# Starts the Docker daemon in the Cloud Agent VM (the image installs it; see .cursor/Dockerfile) and
# gives the ubuntu user the socket. Same procedure as mattermost/mattermost's .cursor/scripts/cloud-agent-start.sh.
# Safe to re-run. Exit 0 when `docker info` works.
set -Eeuo pipefail

log() { printf '[cloud-agent-docker] %s\n' "$*" >&2; }

command -v docker >/dev/null 2>&1 || { log "Docker CLI is missing; the image did not build from .cursor/Dockerfile."; exit 1; }

ensure_docker_socket_access() {
  [ -S /var/run/docker.sock ] || return 0
  sudo groupadd -f docker
  sudo usermod -aG docker "$(id -un)"
  sudo chgrp docker /var/run/docker.sock >/dev/null 2>&1 || true
  sudo chmod g+rw /var/run/docker.sock >/dev/null 2>&1 || true
  if command -v setfacl >/dev/null 2>&1; then
    sudo setfacl -m "u:$(id -un):rw" /var/run/docker.sock >/dev/null 2>&1 || true
  fi
}

docker_login_if_configured() {
  if [ -z "${DOCKERHUB_USERNAME:-}" ] || [ -z "${DOCKERHUB_TOKEN:-}" ]; then
    log "Docker Hub credentials not configured; anonymous pulls may hit rate limits."
    return 0
  fi
  if printf '%s' "${DOCKERHUB_TOKEN}" | docker login -u "${DOCKERHUB_USERNAME}" --password-stdin >/tmp/docker-login.log 2>&1; then
    log "Docker Hub login succeeded."
  else
    log "Docker Hub login failed; see /tmp/docker-login.log."
  fi
}

ensure_docker_socket_access
if docker info >/dev/null 2>&1; then
  log "Docker is already running."
  docker_login_if_configured
  exit 0
fi

log "Starting Docker daemon."
if command -v service >/dev/null 2>&1; then
  sudo sh -c 'service docker start >/tmp/docker-service-start.log 2>&1' || log "service docker start failed; starting dockerd directly."
fi
if ! pgrep -x dockerd >/dev/null 2>&1; then
  sudo sh -c 'nohup dockerd --host=unix:///var/run/docker.sock >/tmp/dockerd.log 2>&1 &'
fi

for _ in $(seq 60); do
  ensure_docker_socket_access
  if docker info >/dev/null 2>&1; then
    log "Docker is ready ($(docker version --format '{{.Server.Version}}'))."
    docker_login_if_configured
    exit 0
  fi
  sleep 1
done

log "Docker did not become ready within 60 seconds."
[ -f /tmp/docker-service-start.log ] && tail -n 40 /tmp/docker-service-start.log >&2
[ -f /tmp/dockerd.log ] && tail -n 80 /tmp/dockerd.log >&2
exit 1
