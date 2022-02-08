#!/usr/bin/env bash
set -e

ARCH="${1}"
VERSION="$(jq -r '.version' <package.json)"
STABLE_VERSION="$(./node_modules/.bin/semver $VERSION -c)"
RELEASE_VERSION="${VERSION/$STABLE_VERSION/}"
RELEASE_VERSION="${RELEASE_VERSION/-/}"
RELEASE_VERSION="${RELEASE_VERSION%.*}"

if ["$RELEASE_VERSION" == ""]; then
    RELEASE_VERSION="latest"
fi

echo "${RELEASE_VERSION}"
VERSION=$VERSION yq eval -i '.files[].url |= strenv(VERSION) + "/" + .' ./release/${RELEASE_VERSION}${1}.yml
