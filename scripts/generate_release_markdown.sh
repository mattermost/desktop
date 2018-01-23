#!/bin/bash
set -eu
VERSION="$1" # such as 3.7.1, 4.0.0-rc1
cat <<-MD
### Mattermost Desktop ${VERSION} has been cut!
The download links can be found below.

#### Linux
https://releases.mattermost.com/desktop/${VERSION}/mattermost-desktop-${VERSION}-linux-ia32.tar.gz
https://releases.mattermost.com/desktop/${VERSION}/mattermost-desktop-${VERSION}-linux-x64.tar.gz
https://releases.mattermost.com/desktop/${VERSION}/mattermost-desktop-${VERSION}-linux-amd64.deb
https://releases.mattermost.com/desktop/${VERSION}/mattermost-desktop-${VERSION}-linux-i386.deb

#### Mac
https://releases.mattermost.com/desktop/${VERSION}/mattermost-desktop-${VERSION}-osx.tar.gz

#### Windows
https://releases.mattermost.com/desktop/${VERSION}/mattermost-desktop-${VERSION}-win32.zip
https://releases.mattermost.com/desktop/${VERSION}/mattermost-desktop-${VERSION}-win64.zip
https://releases.mattermost.com/desktop/${VERSION}/mattermost-setup-${VERSION}-win32.exe
https://releases.mattermost.com/desktop/${VERSION}/mattermost-setup-${VERSION}-win64.exe
MD
