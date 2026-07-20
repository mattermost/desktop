#!/usr/bin/env bash
set -Eeuo pipefail

log() {
    printf '[cloud-agent-start] %s\n' "$*" >&2
}

DISPLAY="${DISPLAY:-:99}"
export DISPLAY

persist_dbus_env() {
    printf 'export DBUS_SESSION_BUS_ADDRESS=%s\n' "${DBUS_SESSION_BUS_ADDRESS}" > /home/ubuntu/.cloud-agent-env
}

ensure_dbus() {
    if [ -n "${DBUS_SESSION_BUS_ADDRESS:-}" ]; then
        persist_dbus_env
        return 0
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

ensure_dbus
ensure_xvfb

log "Headless display environment configured (DISPLAY=${DISPLAY})."
