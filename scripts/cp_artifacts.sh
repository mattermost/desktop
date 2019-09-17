#!/bin/sh
set -eu

VERSION=`cat package.json | jq -r '.version'`
SRC=$1
DEST=$2
if [[ -f "${SRC}/mattermost-desktop-${VERSION}-win-ia32.zip" ]]; then
    cp "${SRC}/mattermost-desktop-${VERSION}-win-ia32.zip" "${DEST}/mattermost-desktop-${VERSION}-win32.zip"
fi
if [[ -f "${SRC}/mattermost-desktop-${VERSION}-win-x64.zip" ]]; then
    cp "${SRC}/mattermost-desktop-${VERSION}-win-x64.zip" "${DEST}/mattermost-desktop-${VERSION}-win64.zip"
fi
if [[ -f "${SRC}/mattermost-desktop-setup-${VERSION}-win.exe" ]]; then
    cp "${SRC}/mattermost-desktop-setup-${VERSION}-win.exe" "${DEST}/"
fi
cp "${SRC}"/mattermost-desktop-*-mac.* "${DEST}/"
cp "${SRC}"/mattermost-desktop-*-linux-* "${DEST}/"
cp "${SRC}"/*.yml "${DEST}/"
cp "${SRC}"/*.blockmap "${DEST}/"
cp "${SRC}"/mac/*.app "${DEST}/"