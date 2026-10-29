#!/usr/bin/env bash
set -Eeuo pipefail

log() {
    printf '[cloud-agent-install] %s\n' "$*" >&2
}

is_true() {
    case "${1:-}" in
        1 | true | TRUE | yes | YES) return 0 ;;
        *) return 1 ;;
    esac
}

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

NODE_VERSION="${CLOUD_AGENT_NODE_VERSION:-24.16.0}"
MATTERMOST_VERSION="${CLOUD_AGENT_MATTERMOST_VERSION:-11.9.0}"
MATTERMOST_DIR="$HOME/mattermost"

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

# Prebuilt Enterprise Edition release (unlicensed, so Team Edition features). It also bundles mmctl.
# The start script runs it against the apt PostgreSQL; there is no Docker or Go toolchain in the image.
ensure_mattermost() {
    if is_true "${CLOUD_AGENT_SKIP_LOCAL_SERVER:-false}"; then
        log "Skipping the Mattermost server download because CLOUD_AGENT_SKIP_LOCAL_SERVER is set."
        return 0
    fi

    if [ -x "$MATTERMOST_DIR/bin/mattermost" ]; then
        log "Mattermost server already present at $MATTERMOST_DIR."
        return 0
    fi

    local tarball
    tarball="$(mktemp /tmp/mattermost.XXXXXX.tar.gz)"
    log "Downloading Mattermost server ${MATTERMOST_VERSION}."
    if ! curl --retry 3 --retry-delay 5 -fsSL -o "$tarball" \
        "https://releases.mattermost.com/${MATTERMOST_VERSION}/mattermost-${MATTERMOST_VERSION}-linux-amd64.tar.gz"; then
        log "Could not download Mattermost server ${MATTERMOST_VERSION}; the local test server will be unavailable."
        rm -f "$tarball"
        return 0
    fi

    tar xzf "$tarball" -C "$HOME"
    rm -f "$tarball"
    log "Mattermost server extracted to $MATTERMOST_DIR."
}

ensure_node

log "Installing dependencies with npm ci."
npm ci

if is_true "${CLOUD_AGENT_SKIP_E2E_DEPS:-false}"; then
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

ensure_mattermost

log "Install hook complete."
