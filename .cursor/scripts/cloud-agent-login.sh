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

for var in "$username_var" "$password_var"; do
    if [ -z "${!var:-}" ]; then
        log "$var is not set."
        exit 1
    fi
done

window="$(xdotool search --onlyvisible --name 'Mattermost' 2>/dev/null | head -n 1 || true)"
if [ -z "$window" ]; then
    log "The Desktop App window was not found on ${DISPLAY}."
    exit 1
fi

# Focus has to go through the app's own top bar, not the server web content; see .cursor/AGENTS.md.
eval "$(xdotool getwindowgeometry --shell "$window")"
xdotool windowfocus "$window"
xdotool mousemove --window "$window" "$((WIDTH / 2))" 20 click 1
sleep 1

printf '%s' "${!username_var}" | xdotool type --delay 30 --file -
xdotool key Tab
printf '%s' "${!password_var}" | xdotool type --delay 30 --file -
xdotool key Return
log "Submitted the ${role} credentials; check the app window for the result."
