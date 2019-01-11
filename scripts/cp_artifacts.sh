#!/bin/sh
set -eu

VERSION=`cat package.json | jq -r '.version'`
SRC=$1
DEST=$2

cp "${SRC}/mattermost-desktop-${VERSION}-win-ia32.zip" "${DEST}/mattermost-desktop-${VERSION}-win32.zip"
cp "${SRC}/mattermost-desktop-${VERSION}-win-x64.zip" "${DEST}/mattermost-desktop-${VERSION}-win64.zip"
cp "${SRC}/mattermost-desktop-setup-${VERSION}-win.exe" "${DEST}/"
cp "${SRC}"/mattermost-desktop-*-mac.* "${DEST}/"
cp "${SRC}"/mattermost-desktop-*-linux-* "${DEST}/"
cp "${SRC}"/*.yml "${DEST}/"
cp "${SRC}"/*.blockmap "${DEST}/"
