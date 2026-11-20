#!/bin/sh
set -e

WORKING_DIR=$(pwd)
THIS_PATH=$(readlink -f "$0")
cd "$(dirname "$THIS_PATH")"
FULL_PATH=$(pwd)
cd "$WORKING_DIR"

cat <<EOS > com.Mattermost.Desktop.desktop
[Desktop Entry]
Name=Mattermost
Comment=Mattermost Desktop application for Linux
Exec="${FULL_PATH}/com.Mattermost.Desktop" %U
Terminal=false
Type=Application
MimeType=x-scheme-handler/mattermost
Icon="${FULL_PATH}/app_icon.png"
Categories=Network;InstantMessaging;
StartupWMClass=com.Mattermost.Desktop
EOS

chmod +x com.Mattermost.Desktop.desktop
