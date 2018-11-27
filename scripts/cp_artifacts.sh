#!/bin/sh
set -eu

VERSION=`cat package.json | jq -r '.version'`
SRC=$1
DEST=$2

cp "${SRC}/mattermost-${VERSION}-win-ia32.zip" "${DEST}/mattermost-desktop-${VERSION}-win32.zip"
cp "${SRC}/mattermost-${VERSION}-win-x64.zip" "${DEST}/mattermost-desktop-${VERSION}-win64.zip"
cp "${SRC}/squirrel-windows/mattermost-setup-${VERSION}.exe" "${DEST}/mattermost-setup-${VERSION}-win64.exe"
cp "${SRC}/squirrel-windows-ia32/mattermost-setup-${VERSION}-ia32.exe" "${DEST}/mattermost-setup-${VERSION}-win32.exe"
cp "${SRC}"/mattermost-desktop-*.zip "${DEST}/"
cp "${SRC}"/*.tar.gz "${DEST}/"
cp "${SRC}"/*.deb "${DEST}/"
cp "${SRC}"/*.AppImage "${DEST}/"
