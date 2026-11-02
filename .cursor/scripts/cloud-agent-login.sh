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

windows="$(xdotool search --onlyvisible --class '^electron$' 2>/dev/null || true)"
if [ -z "$windows" ] || [ "$(wc -l <<<"$windows")" -ne 1 ]; then
    log "Expected exactly one visible Electron window on ${DISPLAY}; not typing credentials."
    exit 1
fi
window="$windows"

# Focus has to go through the app's own top bar, not the server web content; see .cursor/AGENTS.md.
eval "$(xdotool getwindowgeometry --shell "$window")"
xdotool windowfocus "$window"
xdotool mousemove --window "$window" "$((WIDTH / 2))" 20 click 1
sleep 1

# The login page is light across the left edge, where a signed-in app shows its dark sidebar. There is no DOM
# access from here, so this is the guard against typing credentials into a signed-in or still-loading app.
is_light_pixel() {
    local rgb channel
    rgb="$(ffmpeg -loglevel error -f x11grab -video_size "${WIDTH}x${HEIGHT}" -i "${DISPLAY}+${X},${Y}" \
        -frames:v 1 -vf "crop=1:1:$1:$2" -f rawvideo -pix_fmt rgb24 - | od -An -tu1)" || return 1
    for channel in $rgb; do
        [ "$channel" -ge 235 ] || return 1
    done
    [ -n "$rgb" ]
}

if ! is_light_pixel "$((WIDTH / 10))" "$((HEIGHT / 2))" || ! is_light_pixel "$((WIDTH / 10))" "$((HEIGHT * 9 / 10))"; then
    log "The login page is not showing (already signed in or still loading); not typing credentials."
    exit 1
fi

printf '%s' "${!username_var}" | xdotool type --delay 30 --file -
xdotool key Tab
printf '%s' "${!password_var}" | xdotool type --delay 30 --file -
xdotool key Return
log "Submitted the ${role} credentials; check the app window for the result."
