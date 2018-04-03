#!/bin/sh
set -eu

VERSION=`cat package.json | jq -r '.version'`
SRC=$1
DEST=$2

cp "${SRC}/Mattermost-${VERSION}-win.zip" "${DEST}/mattermost-desktop-${VERSION}-win64.zip"
cp "${SRC}/Mattermost-${VERSION}-ia32-win.zip" "${DEST}/mattermost-desktop-${VERSION}-win32.zip"
cp "${SRC}/squirrel-windows/Mattermost Setup ${VERSION}.exe" "${DEST}/mattermost-setup-${VERSION}-win64.exe"
cp "${SRC}/squirrel-windows-ia32/Mattermost Setup ${VERSION}.exe" "${DEST}/mattermost-setup-${VERSION}-win32.exe"

cp "${SRC}/Mattermost-${VERSION}-mac.zip" "${DEST}/mattermost-desktop-${VERSION}-mac.zip"

cp "${SRC}/mattermost-desktop-${VERSION}.tar.gz" "${DEST}/mattermost-desktop-${VERSION}-linux-x64.tar.gz"
cp "${SRC}/mattermost-desktop-${VERSION}-ia32.tar.gz" "${DEST}/mattermost-desktop-${VERSION}-linux-ia32.tar.gz"
cp "${SRC}/mattermost-desktop_${VERSION}_amd64.deb" "${DEST}/mattermost-desktop-${VERSION}-linux-x64.deb"
cp "${SRC}/mattermost-desktop_${VERSION}_i386.deb" "${DEST}/mattermost-desktop-${VERSION}-linux-i386.deb"
