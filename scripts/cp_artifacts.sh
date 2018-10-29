#!/bin/sh
set -eu

VERSION=`cat package.json | jq -r '.version'`
SRC=$1
DEST=$2

cp "${SRC}/mattermost-desktop-${VERSION}-win-ia32.zip" "${DEST}/"
cp "${SRC}/mattermost-desktop-${VERSION}-win-x64.zip" "${DEST}/"
cp "${SRC}/mattermost-desktop-setup-${VERSION}-win.exe" "${DEST}/"
cp "${SRC}"/mattermost-desktop-*.zip "${DEST}/"
cp "${SRC}"/*.tar.gz "${DEST}/"
cp "${SRC}"/*.deb "${DEST}/"
cp "${SRC}"/*.AppImage "${DEST}/"
cp "${SRC}"/*.yml "${DEST}/"
