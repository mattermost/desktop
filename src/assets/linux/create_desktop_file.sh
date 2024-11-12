#!/bin/sh
set -e
WORKING_DIR=`pwd`
THIS_PATH=`readlink -f $0`
cd `dirname ${THIS_PATH}`
FULL_PATH=`pwd`
cd "${WORKING_DIR}"
cat <<EOS > Mattermost.desktop
[Desktop Entry]
Name=Mattermost
Comment=Mattermost Desktop application for Linux
Exec="${FULL_PATH}/mattermost-desktop" %U
Terminal=false
Type=Application
MimeType=x-scheme-handler/mattermost
Icon=${FULL_PATH}/app_icon.png
Categories=Network;InstantMessaging;
EOS
chmod +x Mattermost.desktop
