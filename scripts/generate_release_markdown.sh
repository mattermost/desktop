#!/bin/bash
set -eu

# Requires sha256sum, on osx you can do
# brew install coreutils

function print_link {
  local URL="${1}"
  local CHECKSUM="$(curl -s -S -L "${URL}" | sha256sum | awk '{print $1}')"
  echo "- ${URL}"
  echo "  - SHA-256 Checksum: \`${CHECKSUM}\`"
}

VERSION="$1" # such as 3.7.1, 4.0.0-rc1
BASE_URL="https://releases.mattermost.com/desktop/${VERSION}"

cat <<-MD
### Mattermost Desktop v${VERSION} has been cut!

Release notes can be found here: https://docs.mattermost.com/help/apps/desktop-changelog.html

The download links can be found below.

#### Windows - msi files (beta)
$(print_link "${BASE_URL}/mattermost-desktop-${VERSION}-x64.msi")
$(print_link "${BASE_URL}/mattermost-desktop-${VERSION}-x86.msi")

#### Windows - setup exe files
$(print_link "${BASE_URL}/mattermost-desktop-setup-${VERSION}-win.exe")

#### Windows - zip files
$(print_link "${BASE_URL}/mattermost-desktop-${VERSION}-win-ia32.zip")
$(print_link "${BASE_URL}/mattermost-desktop-${VERSION}-win-x64.zip")

#### Mac
$(print_link "${BASE_URL}/mattermost-desktop-${VERSION}-mac.dmg")

#### Linux
$(print_link "${BASE_URL}/mattermost-desktop-${VERSION}-linux-ia32.tar.gz")
$(print_link "${BASE_URL}/mattermost-desktop-${VERSION}-linux-x64.tar.gz")

#### Linux (Unofficial) - deb files
$(print_link "${BASE_URL}/mattermost-desktop-${VERSION}-linux-i386.deb")
$(print_link "${BASE_URL}/mattermost-desktop-${VERSION}-linux-amd64.deb")

#### Linux (Unofficial) - AppImage files
$(print_link "${BASE_URL}/mattermost-desktop-${VERSION}-linux-i386.AppImage")
$(print_link "${BASE_URL}/mattermost-desktop-${VERSION}-linux-x86_64.AppImage")
MD
