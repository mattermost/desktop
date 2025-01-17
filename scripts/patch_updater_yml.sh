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

# If we are on a ESR branch, we don't want to generate the auto-updater yml for patch releases
if [ -e .esr ] && [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[1-9][0-9]* ]]; then
    echo "ESR branch, skipping auto-updater yml generation"
    rm ./release/"${RELEASE_VERSION}"*.yml
    exit 0
fi

echo "${RELEASE_VERSION}"
if compgen -G "./release/${RELEASE_VERSION}*.yml" > /dev/null; then
    for i in ./release/${RELEASE_VERSION}*.yml; do
        VERSION=$VERSION yq eval -i '.files[].url |= strenv(VERSION) + "/" + .' $i
    done
fi

