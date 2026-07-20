#!/usr/bin/env bash
set -Eeuo pipefail

log() {
    printf '[cloud-agent-start] %s\n' "$*" >&2
}

DISPLAY="${DISPLAY:-:99}"
export DISPLAY
export ELECTRON_DISABLE_SANDBOX="${ELECTRON_DISABLE_SANDBOX:-1}"

ensure_dbus() {
    sudo service dbus start >/dev/null 2>&1 || true

    if [ -S /run/dbus/system_bus_socket ]; then
        export DBUS_SESSION_BUS_ADDRESS="unix:path=/run/dbus/system_bus_socket"
    elif [ -S /var/run/dbus/system_bus_socket ]; then
        export DBUS_SESSION_BUS_ADDRESS="unix:path=/var/run/dbus/system_bus_socket"
    elif command -v dbus-launch >/dev/null 2>&1; then
        # shellcheck disable=SC1091
        eval "$(dbus-launch --sh-syntax)" || log "Could not start a D-Bus session; Electron may still launch."
    fi

    if [ -n "${DBUS_SESSION_BUS_ADDRESS:-}" ]; then
        printf 'export DBUS_SESSION_BUS_ADDRESS=%s\n' "${DBUS_SESSION_BUS_ADDRESS}" > /home/ubuntu/.cloud-agent-env
    fi
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
}

ensure_dbus || true
ensure_xvfb || true

log "Headless display environment configured (DISPLAY=${DISPLAY})."
