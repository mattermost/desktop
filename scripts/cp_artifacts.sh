#!/bin/sh
set -eu

VERSION=`cat package.json | jq -r '.version'`
SRC=$1
DEST=$2

cp "${SRC}/mattermost-${VERSION}-win-ia32.zip" "${DEST}/mattermost-desktop-${VERSION}-win-ia32.zip"
cp "${SRC}/mattermost-${VERSION}-win-x64.zip" "${DEST}/mattermost-desktop-${VERSION}-win-x64.zip"
cp "${SRC}/squirrel-windows/mattermost-setup-${VERSION}.exe" "${DEST}/mattermost-setup-${VERSION}-x64.exe"
cp "${SRC}"/squirrel-windows-ia32/*.exe "${DEST}/"
cp "${SRC}"/mattermost-desktop-*.zip "${DEST}/"
cp "${SRC}"/*.tar.gz "${DEST}/"
cp "${SRC}"/*.deb "${DEST}/"
