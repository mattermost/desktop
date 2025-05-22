#!/usr/bin/env bash
set -e

VERSION="$(jq -r '.version' <package.json)"
STABLE_VERSION="$(npx semver $VERSION -c)"
RELEASE_VERSION="${VERSION/$STABLE_VERSION/}"
RELEASE_VERSION="${RELEASE_VERSION/-/}"
RELEASE_VERSION="${RELEASE_VERSION%.*}"

if [ "$RELEASE_VERSION" == "" ]; then
    RELEASE_VERSION="latest"
fi

# If we are on a ESR branch, we don't want to generate the auto-updater yml if there is a newer version
NEXT_MINOR_VERSION="$(npx semver $STABLE_VERSION -i minor)"
NEXT_MAJOR_VERSION="$(npx semver $STABLE_VERSION -i major)"
NEWER_VERSION_EXISTS="$(git ls-remote --tags origin v${NEXT_MINOR_VERSION} v${NEXT_MAJOR_VERSION})"
if [ -e .esr ] && [ ! -z "$NEWER_VERSION_EXISTS" ]; then
    echo "ESR branch, skipping auto-updater yml generation"
    rm ./release/"${RELEASE_VERSION}"*.yml || true
    exit 0
fi

echo "${RELEASE_VERSION}"
if compgen -G "./release/${RELEASE_VERSION}*.yml" > /dev/null; then
    for i in ./release/${RELEASE_VERSION}*.yml; do
        VERSION=$VERSION yq eval -i '.files[].url |= strenv(VERSION) + "/" + .' $i
    done
fi

