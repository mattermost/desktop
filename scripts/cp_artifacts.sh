#!/bin/sh
set -eu

VERSION=`cat package.json | jq -r '.version'`
SRC=$1
DEST=$2
if [[ -f "${SRC}/mattermost-desktop-${VERSION}-win-ia32.zip" ]]; then
    echo "Copying Win32\n"
    cp "${SRC}/mattermost-desktop-${VERSION}-win-ia32.zip" "${DEST}/mattermost-desktop-${VERSION}-win32.zip"
fi
if [[ -f "${SRC}/mattermost-desktop-${VERSION}-win-x64.zip" ]]; then
    echo "Copying Win64\n"
    cp "${SRC}/mattermost-desktop-${VERSION}-win-x64.zip" "${DEST}/mattermost-desktop-${VERSION}-win64.zip"
fi
if [[ -f "${SRC}/mattermost-desktop-setup-${VERSION}-win.exe" ]]; then
    echo "Copying win-no-arch\n"
    cp "${SRC}/mattermost-desktop-setup-${VERSION}-win.exe" "${DEST}/"
fi
if [[ -f "${SRC}"/mattermost-desktop-*-mac.* ]]; then
    echo "Copying mac\n"
    cp "${SRC}"/mattermost-desktop-*-mac.* "${DEST}/"
    cp "${SRC}"/mac/*.app "${DEST}/"
fi
if [[ -f "${SRC}"/mattermost-desktop-*-linux-* ]]; then
    echo "Copying linux"
    cp "${SRC}"/mattermost-desktop-*-linux-* "${DEST}/"
fi
cp "${SRC}"/*.yml "${DEST}/"
cp "${SRC}"/*.blockmap "${DEST}/"
