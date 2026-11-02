#!/usr/bin/env bash
set -Eeuo pipefail

log() {
    printf '[cloud-agent-start] %s\n' "$*" >&2
}

DISPLAY="${DISPLAY:-:99}"
export DISPLAY

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

# Checks the EWMH window-manager property on $DISPLAY rather than for an xfwm4 process, which could belong to
# another display. Without a window manager the app's windows have no frames or focus handling.
ensure_window_manager() {
    # The root property can outlive a window manager that exited, so also check that the window it names still
    # exists and points back at itself.
    local wm_window
    wm_window="$(xprop -root _NET_SUPPORTING_WM_CHECK 2>/dev/null | awk '/window id/ {print $NF; exit}')" || wm_window=""
    if [ -n "$wm_window" ] &&
        xprop -id "$wm_window" _NET_SUPPORTING_WM_CHECK 2>/dev/null |
        awk -v wm_window="$wm_window" '/window id/ && $NF == wm_window {found=1} END {exit !found}'; then
        return 0
    fi
    if ! command -v xfwm4 >/dev/null 2>&1; then
        log "xfwm4 is not installed; GUI windows will be unmanaged."
        return 0
    fi
    setsid nohup xfwm4 --compositor=off >/tmp/xfwm4.log 2>&1 </dev/null &
    log "Started xfwm4."
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

# Points the app at the shared cloud test server named by the DESKTOP_MATTERMOST_URL secret, so a fresh app
# launch opens it directly. Never print the URL or credentials; they are secrets.
configure_cloud_server() {
    if [ -z "${DESKTOP_MATTERMOST_URL:-}" ]; then
        log "DESKTOP_MATTERMOST_URL is not set; only public servers and server-less UI can be tested."
        return 0
    fi

    local config_dir="$HOME/.config/Electron"
    mkdir -p "$config_dir"
    CONFIG_FILE="$config_dir/config.json" python3 - <<'PY'
import json
import os

path = os.environ["CONFIG_FILE"]
url = os.environ["DESKTOP_MATTERMOST_URL"].strip()
try:
    with open(path) as f:
        config = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    config = {"version": 4}
servers = config.setdefault("servers", [])
index = next((i for i, s in enumerate(servers) if s.get("url", "").rstrip("/") == url.rstrip("/")), None)
if index is None:
    servers.append({"name": "cloud-test-server", "url": url, "order": len(servers)})
    index = len(servers) - 1
config["lastActiveServer"] = index
config["hideOnStart"] = False
with open(path, "w") as f:
    json.dump(config, f, indent=2)
PY

    if curl -fsS -m 10 "${DESKTOP_MATTERMOST_URL%/}/api/v4/system/ping" >/dev/null 2>&1; then
        log "Cloud test server added to the app config and reachable."
    else
        log "Cloud test server added to the app config but did not answer a ping; check network egress."
    fi
}

ensure_dbus
ensure_xvfb
ensure_window_manager
ensure_shm
configure_cloud_server

log "Headless display environment configured (DISPLAY=${DISPLAY})."
