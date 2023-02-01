#!/usr/bin/env bash
set -e

VERSION="$(jq -r '.version' <package.json)"
STABLE_VERSION="$(./node_modules/.bin/semver $VERSION -c)"
RELEASE_VERSION="${VERSION/$STABLE_VERSION/}"
RELEASE_VERSION="${RELEASE_VERSION/-/}"
RELEASE_VERSION="${RELEASE_VERSION%.*}"

if [ "$RELEASE_VERSION" == "" ]; then
    RELEASE_VERSION="latest"
fi

echo "${RELEASE_VERSION}"
if compgen -G "./release/${RELEASE_VERSION}*.yml" > /dev/null; then
    for i in ./release/${RELEASE_VERSION}*.yml; do
        VERSION=$VERSION yq eval -i '.files[].url |= strenv(VERSION) + "/" + .' $i
    done
fi

