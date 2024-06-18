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

Release notes can be found here: https://docs.mattermost.com/install/desktop-app-changelog.html

The download links can be found below.

#### Windows - installer files
$(print_link "${BASE_URL}/mattermost-desktop-${VERSION}-win-x64.msi")
$(print_link "${BASE_URL}/mattermost-desktop-${VERSION}-win-arm64.msi") (beta)

#### Windows - zip files
$(print_link "${BASE_URL}/mattermost-desktop-${VERSION}-win-x64.zip")
$(print_link "${BASE_URL}/mattermost-desktop-${VERSION}-win-arm64.zip") (beta)

#### Mac
$(print_link "${BASE_URL}/mattermost-desktop-${VERSION}-mac-universal.dmg")
$(print_link "${BASE_URL}/mattermost-desktop-${VERSION}-mac-x64.dmg")
$(print_link "${BASE_URL}/mattermost-desktop-${VERSION}-mac-m1.dmg")

#### Linux
$(print_link "${BASE_URL}/mattermost-desktop-${VERSION}-linux-arm64.tar.gz") (beta)
$(print_link "${BASE_URL}/mattermost-desktop-${VERSION}-linux-x64.tar.gz")

#### Linux (Unofficial) - deb files
$(print_link "${BASE_URL}/mattermost-desktop_${VERSION}-1_arm64.deb") (beta)
$(print_link "${BASE_URL}/mattermost-desktop_${VERSION}-1_amd64.deb")

#### Linux (Unofficial) - rpm files (beta)
$(print_link "${BASE_URL}/mattermost-desktop-${VERSION}-linux-aarch64.rpm") (beta)
$(print_link "${BASE_URL}/mattermost-desktop-${VERSION}-linux-x86_64.rpm")

#### Linux (Unofficial) - AppImage files
$(print_link "${BASE_URL}/mattermost-desktop-${VERSION}-linux-arm64.AppImage") (beta)
$(print_link "${BASE_URL}/mattermost-desktop-${VERSION}-linux-x86_64.AppImage")
MD
