#!/bin/bash
set -eu

function print_link() {
  local URL="${1}"
  local CHECKSUM="$(curl -s -S -L "${URL}" | sha256sum | awk '{print $1}')"
  echo "${URL}"
  echo "  - SHA-256 Checksum: \`${CHECKSUM}\`"
}

VERSION="$1" # such as 3.7.1, 4.0.0-rc1
BASE_URL="https://releases.mattermost.com/desktop/${VERSION}"

cat <<-MD
### Mattermost Desktop ${VERSION} has been cut!
The download links can be found below.

#### Linux
$(print_link "${BASE_URL}/mattermost-desktop-${VERSION}-linux-ia32.tar.gz")
$(print_link "${BASE_URL}/mattermost-desktop-${VERSION}-linux-x64.tar.gz")
$(print_link "${BASE_URL}/mattermost-desktop-${VERSION}-linux-amd64.deb")
$(print_link "${BASE_URL}/mattermost-desktop-${VERSION}-linux-i386.deb")

#### Mac
$(print_link "${BASE_URL}/mattermost-desktop-${VERSION}-osx.tar.gz")

#### Windows
$(print_link "${BASE_URL}/mattermost-desktop-${VERSION}-win32.zip")
$(print_link "${BASE_URL}/mattermost-desktop-${VERSION}-win64.zip")
$(print_link "${BASE_URL}/mattermost-setup-${VERSION}-win32.exe")
$(print_link "${BASE_URL}/mattermost-setup-${VERSION}-win64.exe")
MD
