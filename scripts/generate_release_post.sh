#!/bin/bash
set -eu

VERSION="$1" # such as 5.3.0-rc.1, 5.0.0
LAST_VERSION="$(git for-each-ref --sort=creatordate --format '%(refname)' refs/tags | grep "v[0-9]\.[0-9]\.[0-9]" | grep -v mas | grep -v "v$VERSION" | tail -1 | sed "s/refs\/tags\/v//")"

cat <<-MD
### [v$VERSION](https://github.com/mattermost/desktop/releases/tag/v$VERSION) :tada:
Changes:
$(git cherry -v v$LAST_VERSION v$VERSION | grep ^+ | grep "(#[0-9]\+)" | sed "s/^+\s[a-zA-Z0-9]\+\s/- /" | sed "s/\s(#\([0-9]\+\))$/ [(#\1)](https:\/\/github.com\/mattermost\/desktop\/pull\/\1)/" | sed "s/\[\?MM-\([0-9]\+\)\]\?/[[MM-\1]](https:\/\/mattermost.atlassian.net\/browse\/MM-\1)/")

The release will be available on GitHub shortly.
MD
