#!/usr/bin/env bash
set -Eeuo pipefail

log() {
    printf '[cloud-agent-install] %s\n' "$*" >&2
}

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

NODE_VERSION="${CLOUD_AGENT_NODE_VERSION:-24.16.0}"

source_node() {
    export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
    if [ -s "$NVM_DIR/nvm.sh" ]; then
        # shellcheck source=/dev/null
        . "$NVM_DIR/nvm.sh"
    fi
}

ensure_node() {
    source_node

    if command -v nvm >/dev/null 2>&1; then
        nvm install "$NODE_VERSION" >/dev/null
        nvm alias default "$NODE_VERSION" >/dev/null
        nvm use "$NODE_VERSION" >/dev/null
    fi

    if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
        log "Node.js/npm are not available; check the Cloud Agent Dockerfile build."
        return 1
    fi

    log "Using node $(node --version) and npm $(npm --version)"
}

ensure_node

log "Installing dependencies with npm ci."
npm ci

log "Install hook complete."
