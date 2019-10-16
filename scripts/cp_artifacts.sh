#!/usr/bin/env bash
set -eu

VERSION="$(jq -r '.version' <package.json)"
SRC="${1}"
DEST="${2}"
SOMETHING_COPIED=0
if [[ ! -d "${DEST}" ]]; then
    echo "Can't find destination. Creating \"${DEST}\""
    mkdir -p "${DEST}"
fi

if [[ -f "${SRC}/mattermost-desktop-${VERSION}-win-ia32.zip" ]]; then
    echo -e "Copying Win32\n"
    cp "${SRC}/mattermost-desktop-${VERSION}-win-ia32.zip" "${DEST}/mattermost-desktop-${VERSION}-win32.zip"
    SOMETHING_COPIED=1
fi
if [[ -f "${SRC}/mattermost-desktop-${VERSION}-win-x64.zip" ]]; then
    echo -e "Copying Win64\n"
    cp "${SRC}/mattermost-desktop-${VERSION}-win-x64.zip" "${DEST}/mattermost-desktop-${VERSION}-win64.zip"
    SOMETHING_COPIED=$((SOMETHING_COPIED + 2))
fi
# We are not supplying this since we supply the msi
# if [[ -f "${SRC}/mattermost-desktop-setup-${VERSION}-win.exe" ]]; then
#     echo -e "Copying win-no-arch\n"
#     cp "${SRC}/mattermost-desktop-setup-${VERSION}-win.exe" "${DEST}/"
#     SOMETHING_COPIED=$((SOMETHING_COPIED + 4))
# fi
if [[ -f "${SRC}/mattermost-desktop-${VERSION}-mac.zip" ]]; then
    echo -e "Copying mac\n"
    cp "${SRC}"/mattermost-desktop-*-mac.* "${DEST}/"
    if [[ -f "${SRC}"/mattermost-desktop-${VERSION}-mac.dmg ]]; then
        cp "${SRC}"/*.blockmap "${DEST}/"
    fi
    SOMETHING_COPIED=$((SOMETHING_COPIED + 8))
fi
if [[ -f "${SRC}"/mattermost-desktop-${VERSION}-linux-x64.tar.gz ]]; then
    echo -e "Copying linux\n"
    cp "${SRC}"/mattermost-desktop-*-linux-* "${DEST}/"
    SOMETHING_COPIED=$((SOMETHING_COPIED + 16))
fi

if [[ $SOMETHING_COPIED -eq 0 ]]; then
    echo "Didn't find anything to copy, it seems like something failed"
    # Bash only returns 0-255 values
    exit 1
fi

cp "${SRC}"/*.yml "${DEST}/"

# exit $SOMETHING_COPIED
exit 0

