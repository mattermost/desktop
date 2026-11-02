#!/usr/bin/env bash
# Logs the running Desktop App into the cloud test server by typing the DESKTOP_MATTERMOST_* secrets with
# xdotool. The credentials are read here and never printed, so a computer-use session never sees them.
#
# Usage: cloud-agent-login.sh [user|admin]    (default: user)
set -Eeuo pipefail

log() {
    printf '[cloud-agent-login] %s\n' "$*" >&2
}

export DISPLAY="${DISPLAY:-:99}"

role="${1:-user}"
case "$role" in
admin)
    username_var=DESKTOP_MATTERMOST_ADMIN_USERNAME
    password_var=DESKTOP_MATTERMOST_ADMIN_PASSWORD
    ;;
user)
    username_var=DESKTOP_MATTERMOST_USERNAME
    password_var=DESKTOP_MATTERMOST_USER_PASSWORD
    ;;
*)
    log "Unknown role '$role'; use 'user' or 'admin'."
    exit 2
    ;;
esac

for var in DESKTOP_MATTERMOST_URL "$username_var" "$password_var"; do
    if [ -z "${!var:-}" ]; then
        log "$var is not set."
        exit 1
    fi
done

# The app can't report its active server from here, but with only the cloud server configured it has to be the
# one on screen. Another configured server could be the active one, so refuse rather than send it these credentials.
if ! CONFIG_FILE="$HOME/.config/Electron/config.json" python3 - <<'PY'
import json
import os
import sys

url = os.environ["DESKTOP_MATTERMOST_URL"].strip().rstrip("/")
try:
    with open(os.environ["CONFIG_FILE"]) as f:
        servers = json.load(f).get("servers", [])
except (FileNotFoundError, json.JSONDecodeError):
    sys.exit(1)
sys.exit(0 if len(servers) == 1 and servers[0].get("url", "").rstrip("/") == url else 1)
PY
then
    log "The app config must contain only the cloud test server; not typing credentials."
    exit 1
fi

windows="$(xdotool search --onlyvisible --class '^electron$' 2>/dev/null || true)"
if [ -z "$windows" ] || [ "$(wc -l <<<"$windows")" -ne 1 ]; then
    log "Expected exactly one visible Electron window on ${DISPLAY}; not typing credentials."
    exit 1
fi
window="$windows"

eval "$(xdotool getwindowgeometry --shell "$window")"

pixel_at() {
    ffmpeg -loglevel error -f x11grab -video_size "${WIDTH}x${HEIGHT}" -i "${DISPLAY}+${X},${Y}" \
        -frames:v 1 -vf "crop=1:1:$1:$2" -f rawvideo -pix_fmt rgb24 - | od -An -tu1
}

# There is no DOM access from here, so the page is judged by the left edge: the login page is light there,
# while a signed-in app shows its sidebar. This guards against typing into a signed-in or still-loading app.
login_page_showing() {
    local y rgb channel
    for y in "$((HEIGHT / 2))" "$((HEIGHT * 9 / 10))"; do
        rgb="$(pixel_at "$((WIDTH / 50))" "$y")" || return 1
        [ -n "$rgb" ] || return 1
        for channel in $rgb; do
            [ "$channel" -ge 235 ] || return 1
        done
    done
}

# A signed-in app replaces the login page's light background at the left edge with its sidebar, whatever the
# theme, so any clear change from the pre-login pixel counts as signed in. A failed login leaves that edge as is.
signed_in() {
    local rgb after i
    rgb="$(pixel_at "$((WIDTH / 50))" "$((HEIGHT / 2))")" || return 1
    read -r -a after <<<"$rgb"
    [ "${#after[@]}" -eq 3 ] || return 1
    for i in 0 1 2; do
        if [ "$(( after[i] > baseline[i] ? after[i] - baseline[i] : baseline[i] - after[i] ))" -ge 40 ]; then
            return 0
        fi
    done
    return 1
}

# Focus has to go through the app's own top bar, not the server web content; see .cursor/AGENTS.md.
focus_top_bar() {
    xdotool windowfocus "$window"
    xdotool mousemove --window "$window" "$((WIDTH / 2))" 20 click 1
    sleep 1
}

# The page remembers its last focused field, for example the password after a failed attempt. A reload puts the
# focus back on the username field, which is where typing has to start.
focus_top_bar
xdotool key ctrl+r
sleep 5
focus_top_bar

if ! login_page_showing; then
    log "The login page is not showing (already signed in or still loading); not typing credentials."
    exit 1
fi

baseline_rgb="$(pixel_at "$((WIDTH / 50))" "$((HEIGHT / 2))")" || baseline_rgb=""
read -r -a baseline <<<"$baseline_rgb"
if [ "${#baseline[@]}" -ne 3 ]; then
    log "Could not sample the login page; not typing credentials."
    exit 1
fi

printf '%s' "${!username_var}" | xdotool type --delay 30 --file -
xdotool key Tab
printf '%s' "${!password_var}" | xdotool type --delay 30 --file -
xdotool key Return

for _ in {1..20}; do
    sleep 1
    if signed_in; then
        log "Logged in with the ${role} account."
        exit 0
    fi
done

# A failed login leaves the username visible in the form, so clear both fields before anyone takes a screenshot.
xdotool key ctrl+a BackSpace Tab ctrl+a BackSpace
log "The signed-in app did not appear after submitting the ${role} credentials; the form was cleared."
exit 1
