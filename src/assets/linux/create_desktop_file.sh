#!/bin/sh
set -e
WORKING_DIR=`pwd`
THIS_PATH=`readlink -f $0`
cd `dirname ${THIS_PATH}`
FULL_PATH=`pwd`
cd ${WORKING_DIR}
cat <<EOS > chat.vigstudio.watercare
[Desktop Entry]
Name=Water Care Chat
Comment=Water Care Chat Desktop application for Linux
Exec="${FULL_PATH}/WaterCareChat-desktop"
Terminal=false
Type=Application
Icon=${FULL_PATH}/app_icon.png
Categories=Network;InstantMessaging;
EOS
chmod +x chat.vigstudio.watercare
