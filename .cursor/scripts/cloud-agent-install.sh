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

# The Dockerfile installs these; an environment that wasn't built from it gets them here.
ensure_system_packages() {
    local missing=()
    command -v xfwm4 >/dev/null 2>&1 || missing+=(xfwm4)
    command -v xdotool >/dev/null 2>&1 || missing+=(xdotool)
    command -v xprop >/dev/null 2>&1 || missing+=(x11-utils)
    command -v ffmpeg >/dev/null 2>&1 || missing+=(ffmpeg)
    if [ "${#missing[@]}" -gt 0 ]; then
        log "Installing missing system packages: ${missing[*]}."
        sudo apt-get update -qq
        sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends "${missing[@]}"
    fi
}

ensure_node
ensure_system_packages

log "Installing dependencies with npm ci."
npm ci

if [ "${CLOUD_AGENT_SKIP_E2E_DEPS:-}" = "true" ]; then
    log "Skipping E2E dependency hydration."
else
    log "Installing E2E dependencies."
    npm --prefix e2e ci
fi

log "Setting up the Linux dev sandbox."
npm run linux-dev-setup

# GUI and computer-use testing needs a NODE_ENV=test build (outputs to e2e/dist/); see .cursor/SETUP.md.
log "Building the test bundle."
npm run build-test

log "Install hook complete."
