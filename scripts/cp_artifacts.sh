#!/bin/sh
set -eu

VERSION=`cat package.json | jq -r '.version'`
SRC=$1
DEST=$2

cp "${SRC}/Mattermost-${VERSION}-win.zip" "${DEST}/mattermost-desktop-${VERSION}-win64.zip"
cp "${SRC}/Mattermost-${VERSION}-ia32-win.zip" "${DEST}/mattermost-desktop-${VERSION}-win32.zip"
cp "${SRC}/win/Mattermost Setup ${VERSION}.exe" "${DEST}/mattermost-setup-${VERSION}-win64.exe"
cp "${SRC}/win-ia32/Mattermost Setup ${VERSION}-ia32.exe" "${DEST}/mattermost-setup-${VERSION}-win32.exe"

cp "${SRC}/mac/Mattermost-${VERSION}-mac.tar.gz" "${DEST}/mattermost-desktop-${VERSION}-mac.tar.gz"

cp "${SRC}/mattermost-desktop-${VERSION}.tar.gz" "${DEST}/mattermost-desktop-${VERSION}-linux-x64.tar.gz"
cp "${SRC}/mattermost-desktop-${VERSION}-ia32.tar.gz" "${DEST}/mattermost-desktop-${VERSION}-linux-ia32.tar.gz"
cp "${SRC}/mattermost-desktop-${VERSION}-amd64.deb" "${DEST}/mattermost-desktop-${VERSION}-linux-x64.deb"
cp "${SRC}/mattermost-desktop-${VERSION}-ia32.deb" "${DEST}/mattermost-desktop-${VERSION}-linux-ia32.deb"
