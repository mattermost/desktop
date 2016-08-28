#!/bin/sh
set -e
WORKING_DIR=`pwd`
THIS_PATH=`readlink -f $0`
cd `dirname ${THIS_PATH}`
FULL_PATH=`pwd`
cd ${WORKING_DIR}
cat <<EOS > Mattermost.desktop
[Desktop Entry]
Name=Mattermost
Comment=Mattermost Desktop application for Linux
Exec="${FULL_PATH}/Mattermost"
Terminal=false
Type=Application
Icon=${FULL_PATH}/icon.png
EOS
chmod +x Mattermost.desktop
