#!/usr/bin/env bash
set -eu

VERSION=$(cat package.json | jq -r '.version')
SRC="${1}"
DEST="${2}"
SOMETHING_COPIED=0
if [[ ! -d "${DEST}" ]]; then
    echo "Can't find destination. Creating ${DEST}"
    mkdir -p ${DEST}
fi

if [[ -f "${SRC}/mattermost-desktop-${VERSION}-win-ia32.zip" ]]; then
    echo "Copying Win32\n"
    cp "${SRC}/mattermost-desktop-${VERSION}-win-ia32.zip" "${DEST}/mattermost-desktop-${VERSION}-win32.zip"
    SOMETHING_COPIED=1
fi
if [[ -f "${SRC}/mattermost-desktop-${VERSION}-win-x64.zip" ]]; then
    echo "Copying Win64\n"
    cp "${SRC}/mattermost-desktop-${VERSION}-win-x64.zip" "${DEST}/mattermost-desktop-${VERSION}-win64.zip"
    SOMETHING_COPIED=$(($SOMETHING_COPIED + 2))
fi
if [[ -f "${SRC}/mattermost-desktop-setup-${VERSION}-win.exe" ]]; then
    echo "Copying win-no-arch\n"
    cp "${SRC}/mattermost-desktop-setup-${VERSION}-win.exe" "${DEST}/"
    SOMETHING_COPIED=$(($SOMETHING_COPIED + 4))
fi
if [[ -f "${SRC}"/mattermost-desktop-${VERSION}-mac.zip ]]; then
    echo "Copying mac\n"
    cp "${SRC}"/mattermost-desktop-*-mac.* "${DEST}/"
    if [[ -f "${SRC}"/mattermost-desktop-${VERSION}-mac.dmg ]]; then
        cp "${SRC}"/*.blockmap "${DEST}/"
    fi
    SOMETHING_COPIED=$(($SOMETHING_COPIED + 8))
fi
if [[ -f "${SRC}"/mattermost-desktop-${VERSION}-linux-x64.tar.gz ]]; then
    echo "Copying linux"
    cp "${SRC}"/mattermost-desktop-*-linux-* "${DEST}/"
    SOMETHING_COPIED=$(($SOMETHING_COPIED + 16))
fi

if [[ $SOMETHING_COPIED -eq 0 ]]; then
    echo "didn't find anything to copy, seems like something failed"
    exit -1
fi

cp "${SRC}"/*.yml "${DEST}/"

# exit $SOMETHING_COPIED
exit 0

