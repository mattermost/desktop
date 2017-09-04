#!/bin/sh
set -eu

VERSION=`cat package.json | jq -r '.version'`
SRC=$1
DEST=$2

cp "${SRC}/mattermost-${VERSION}-win-ia32.zip" "${DEST}/mattermost-desktop-${VERSION}-win-ia32.zip"
cp "${SRC}/mattermost-${VERSION}-win-x64.zip" "${DEST}/mattermost-desktop-${VERSION}-win-x64.zip"
cp "${SRC}/mattermost-${VERSION}-win.exe" "${DEST}/mattermost-desktop-${VERSION}-win.exe"
cp "${SRC}"/mattermost-desktop-*.zip "${DEST}/"
cp "${SRC}"/*.tar.gz "${DEST}/"
cp "${SRC}"/*.deb "${DEST}/"
cp "${SRC}"/*.yml "${DEST}/"
