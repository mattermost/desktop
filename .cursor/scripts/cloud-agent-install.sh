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

# Stops a server started from $MATTERMOST_DIR before its files are replaced. Otherwise the old process keeps
# answering on the port from a deleted working directory, and the start script would neither seed it nor
# start the new version.
stop_owned_mattermost() {
    local pid
    for pid in $(pgrep -x mattermost 2>/dev/null || true); do
        if [ "$(readlink "/proc/${pid}/cwd" 2>/dev/null)" = "$MATTERMOST_DIR" ]; then
            log "Stopping Mattermost server ${pid} before replacing $MATTERMOST_DIR."
            kill "$pid" 2>/dev/null || true
            for _ in {1..30}; do
                kill -0 "$pid" 2>/dev/null || break
                sleep 1
            done
            kill -9 "$pid" 2>/dev/null || true
        fi
    done
}

# Unpacks a release tarball into a staging directory, carries over the server config, stored files and
# plugins from an existing install (as Mattermost's upgrade procedure does), then swaps it into place.
install_mattermost_release() {
    local tarball="$1" stage keep
    stage="$(mktemp -d "$HOME/.mattermost-stage.XXXXXX")"
    tar xzf "$tarball" -C "$stage"

    if [ -d "$MATTERMOST_DIR" ]; then
        stop_owned_mattermost
        for keep in config/config.json data plugins client/plugins; do
            if [ -e "$MATTERMOST_DIR/$keep" ]; then
                mkdir -p "$(dirname "$stage/mattermost/$keep")"
                rm -rf "${stage:?}/mattermost/$keep"
                mv "$MATTERMOST_DIR/$keep" "$stage/mattermost/$keep"
            fi
        done
        rm -rf "$MATTERMOST_DIR"
    fi

    mv "$stage/mattermost" "$MATTERMOST_DIR"
    rmdir "$stage"
}

# Prebuilt Enterprise Edition release (unlicensed, so Team Edition features). It also bundles mmctl.
# The start script runs it against the apt PostgreSQL; there is no Docker or Go toolchain in the image.
ensure_mattermost() {
    if is_true "${CLOUD_AGENT_SKIP_LOCAL_SERVER:-false}"; then
        log "Skipping the Mattermost server download because CLOUD_AGENT_SKIP_LOCAL_SERVER is set."
        return 0
    fi

    if [ -x "$MATTERMOST_DIR/bin/mattermost" ]; then
        local installed
        installed="$("$MATTERMOST_DIR/bin/mattermost" version 2>/dev/null | awk '/^Version:/ {print $2}')" || installed=""
        if [ "$installed" = "$MATTERMOST_VERSION" ]; then
            log "Mattermost server ${installed} already present at $MATTERMOST_DIR."
            return 0
        fi
        log "Mattermost server at $MATTERMOST_DIR is ${installed:-an unknown version}; replacing it with ${MATTERMOST_VERSION}."
    fi

    local tarball
    tarball="$(mktemp /tmp/mattermost.XXXXXX.tar.gz)"
    log "Downloading Mattermost server ${MATTERMOST_VERSION}."
    if ! curl --retry 3 --retry-delay 5 -fsSL -o "$tarball" \
        "https://releases.mattermost.com/${MATTERMOST_VERSION}/mattermost-${MATTERMOST_VERSION}-linux-amd64.tar.gz"; then
        log "Could not download Mattermost server ${MATTERMOST_VERSION}; any existing install is left in place."
        rm -f "$tarball"
        return 0
    fi

    install_mattermost_release "$tarball"
    rm -f "$tarball"
    log "Mattermost server extracted to $MATTERMOST_DIR."
}

# The Dockerfile installs these; an environment that wasn't built from it (no PostgreSQL cluster) gets them here.
ensure_system_packages() {
    local missing=()
    # pg_lsclusters ships with postgresql-common, which can be installed without the server itself.
    compgen -G '/usr/lib/postgresql/*/bin/postgres' >/dev/null || missing+=(postgresql)
    command -v psql >/dev/null 2>&1 || missing+=(postgresql-client)
    command -v xfwm4 >/dev/null 2>&1 || missing+=(xfwm4)
    command -v xdotool >/dev/null 2>&1 || missing+=(xdotool)
    if [ "${#missing[@]}" -gt 0 ]; then
        log "Installing missing system packages: ${missing[*]}."
        sudo apt-get update -qq
        sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends "${missing[@]}"
    fi

    if [ -z "$(pg_lsclusters --no-header 2>/dev/null)" ]; then
        local pg_version
        pg_version="$(find /usr/lib/postgresql -mindepth 1 -maxdepth 1 -printf '%f\n' 2>/dev/null | sort -V | tail -n 1)"
        if [ -n "$pg_version" ]; then
            log "Creating PostgreSQL ${pg_version} cluster 'main'."
            sudo pg_createcluster "$pg_version" main
        else
            log "No PostgreSQL server installed; the local Mattermost server cannot start."
        fi
    fi
}

ensure_node
ensure_system_packages

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
