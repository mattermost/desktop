#!/usr/bin/env bash
set -Eeuo pipefail

log() {
    printf '[cloud-agent-start] %s\n' "$*" >&2
}

is_true() {
    case "${1:-}" in
        1 | true | TRUE | yes | YES) return 0 ;;
        *) return 1 ;;
    esac
}

DISPLAY="${DISPLAY:-:99}"
export DISPLAY

MATTERMOST_DIR="$HOME/mattermost"
MATTERMOST_URL="http://localhost:8065"
MATTERMOST_LOG="/tmp/mattermost-server.log"
DB_NAME="mattermost_test"
DB_USER="mmuser"
DB_PASSWORD="mmuser_password"

persist_dbus_env() {
    printf 'export DBUS_SESSION_BUS_ADDRESS=%q\n' "${DBUS_SESSION_BUS_ADDRESS}" > /home/ubuntu/.cloud-agent-env
}

probe_dbus_session() {
    timeout 2 dbus-send --session --print-reply \
        --dest=org.freedesktop.DBus /org/freedesktop/DBus \
        org.freedesktop.DBus.GetId >/dev/null 2>&1
}

ensure_dbus() {
    if [ -n "${DBUS_SESSION_BUS_ADDRESS:-}" ]; then
        if probe_dbus_session; then
            persist_dbus_env
            return 0
        fi
        log "Existing DBUS_SESSION_BUS_ADDRESS is unreachable; starting a new session bus."
        unset DBUS_SESSION_BUS_ADDRESS
    fi

    if ! command -v dbus-launch >/dev/null 2>&1; then
        log "dbus-launch is required but not available."
        return 1
    fi

    # shellcheck disable=SC1091
    eval "$(dbus-launch --sh-syntax)" || {
        log "Could not start a D-Bus session bus."
        return 1
    }

    if [ -z "${DBUS_SESSION_BUS_ADDRESS:-}" ]; then
        log "dbus-launch did not set DBUS_SESSION_BUS_ADDRESS."
        return 1
    fi

    persist_dbus_env
}

ensure_xvfb() {
    if pgrep -f "Xvfb ${DISPLAY}" >/dev/null 2>&1; then
        log "Xvfb is already running on ${DISPLAY}."
        return 0
    fi

    Xvfb "${DISPLAY}" -screen 0 1920x1080x24 -ac +extension GLX +render -noreset >/tmp/xvfb.log 2>&1 &
    for _ in {1..30}; do
        if xdpyinfo -display "${DISPLAY}" >/dev/null 2>&1; then
            log "Xvfb is ready on ${DISPLAY}."
            return 0
        fi
        sleep 0.2
    done

    log "Xvfb did not become ready on ${DISPLAY}; see /tmp/xvfb.log."
    tail -n 20 /tmp/xvfb.log >&2 || true
    return 1
}

# Electron/Chromium renderers share /dev/shm; the 64MB default surfaces as ERR_INSUFFICIENT_RESOURCES
# once a real Mattermost server is loaded in a WebContentsView.
ensure_shm() {
    if sudo mount -o remount,size=2G /dev/shm 2>/dev/null; then
        log "/dev/shm remounted at 2G."
    else
        log "Could not remount /dev/shm; server views may fail with ERR_INSUFFICIENT_RESOURCES."
    fi
}

ensure_postgres() {
    local cluster version
    cluster="$(pg_lsclusters --no-header 2>/dev/null | head -n 1 || true)"
    if [ -z "$cluster" ]; then
        log "No PostgreSQL cluster found; skipping the local Mattermost server."
        return 1
    fi
    version="$(awk '{print $1}' <<<"$cluster")"

    if ! pg_isready -q; then
        sudo pg_ctlcluster "$version" main start
        for _ in {1..30}; do
            pg_isready -q && break
            sleep 1
        done
    fi
    pg_isready -q || {
        log "PostgreSQL did not become ready."
        return 1
    }

    if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
        sudo -u postgres psql -qc "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';"
    fi
    if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
        sudo -u postgres psql -qc "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
    fi
}

mattermost_ready() {
    curl -fsS -m 2 "${MATTERMOST_URL}/api/v4/system/ping" >/dev/null 2>&1
}

# True when a `mattermost` process started from $MATTERMOST_DIR is running, as opposed to some other
# server that happens to answer on the same port.
owned_mattermost_running() {
    local pid
    for pid in $(pgrep -x mattermost 2>/dev/null || true); do
        if [ "$(readlink "/proc/${pid}/cwd" 2>/dev/null)" = "$MATTERMOST_DIR" ]; then
            return 0
        fi
    done
    return 1
}

# Runs an mmctl command and tolerates only "already exists" failures, so re-runs are idempotent
# while real errors (for example local mode being disabled) are reported.
mmctl_seed() {
    local output
    if output="$("$MATTERMOST_DIR/bin/mmctl" --local "$@" 2>&1)"; then
        return 0
    fi
    if grep -qi "already exists" <<<"$output"; then
        return 0
    fi
    log "mmctl --local $1 $2 failed: ${output//$'\n'/ }"
    return 1
}

# Local mode lets mmctl seed without authenticating. Onboarding is disabled so the "Welcome to Mattermost"
# checklist modal doesn't appear after login. Seeded accounts match the credentials in e2e/AGENTS.md.
seed_mattermost() {
    local mmctl="$MATTERMOST_DIR/bin/mmctl"
    local failed=0
    mmctl_seed user create --email admin@example.com --username sysadmin --password 'Sys@dmin-sample1' --system-admin || failed=1
    mmctl_seed user create --email user1@example.com --username user-1 --password 'User-Test-123!' || failed=1
    mmctl_seed team create --name main --display-name "Main Team" || failed=1
    mmctl_seed team users add main sysadmin user-1 || failed=1

    "$mmctl" --local user search sysadmin >/dev/null 2>&1 || { log "Seeded user sysadmin not found."; failed=1; }
    "$mmctl" --local user search user-1 >/dev/null 2>&1 || { log "Seeded user user-1 not found."; failed=1; }
    "$mmctl" --local team search main >/dev/null 2>&1 || { log "Seeded team main not found."; failed=1; }
    return "$failed"
}

ensure_mattermost() {
    if is_true "${CLOUD_AGENT_SKIP_LOCAL_SERVER:-false}"; then
        log "Skipping the local Mattermost server because CLOUD_AGENT_SKIP_LOCAL_SERVER is set."
        return 0
    fi
    if [ ! -x "$MATTERMOST_DIR/bin/mattermost" ]; then
        log "Mattermost server not installed at $MATTERMOST_DIR; skipping the local test server."
        return 0
    fi
    ensure_postgres || return 0

    if mattermost_ready && ! owned_mattermost_running; then
        log "Something other than ${MATTERMOST_DIR}/bin/mattermost is already answering at ${MATTERMOST_URL}; not seeding it."
        return 0
    fi

    if ! mattermost_ready; then
        (
            cd "$MATTERMOST_DIR"
            export MM_SQLSETTINGS_DRIVERNAME=postgres
            export MM_SQLSETTINGS_DATASOURCE="postgres://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}?sslmode=disable&connect_timeout=10"
            export MM_SERVICESETTINGS_SITEURL="$MATTERMOST_URL"
            export MM_SERVICESETTINGS_LISTENADDRESS="127.0.0.1:8065"
            export MM_SERVICESETTINGS_ENABLELOCALMODE=true
            export MM_SERVICESETTINGS_ENABLEONBOARDINGFLOW=false
            setsid nohup ./bin/mattermost >"$MATTERMOST_LOG" 2>&1 </dev/null &
        )
        for _ in {1..120}; do
            mattermost_ready && break
            sleep 1
        done
    fi

    if ! mattermost_ready; then
        log "Mattermost did not become ready; see $MATTERMOST_LOG."
        tail -n 20 "$MATTERMOST_LOG" >&2 || true
        return 0
    fi

    if seed_mattermost; then
        log "Mattermost is ready at ${MATTERMOST_URL} (sysadmin / Sys@dmin-sample1)."
    else
        log "Mattermost is running at ${MATTERMOST_URL} but seeding the test accounts failed; see the messages above."
    fi
}

ensure_dbus
ensure_xvfb
ensure_shm
ensure_mattermost

log "Headless display environment configured (DISPLAY=${DISPLAY})."
